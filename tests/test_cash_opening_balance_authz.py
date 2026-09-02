"""PATCH /cash/sessions/{id}/opening-balance solo filtraba por organization_id.

Hallazgo MEDIA-ALTA (revisión final): cualquier usuario de la organización
—incluido uno de otra sucursal— podía corregir el fondo declarado del turno
de otra persona, porque la ruta nunca comparaba `session.user_id` ni el rol
de quien hace la petición contra el dueño del turno. Ahora aplica la misma
regla que `/sessions/{id}/close-guided`: el dueño del turno, o un rol
GERENTE/ADMINISTRADOR/DUEÑO.
"""
from decimal import Decimal

from app.core.security import create_access_token, get_password_hash
from app.models.cash import CashSession
from app.models.users import PlatformRole, Role, User, UserOrganization


def _make_user(db, org, branch, username, role):
    u = User(
        username=username, password_hash=get_password_hash("test1234"),
        role=role, branch_id=branch.id if branch else None,
        is_active=True, platform_role=PlatformRole.NONE,
    )
    db.add(u)
    db.flush()
    db.add(UserOrganization(user_id=u.id, organization_id=org.id, org_role="MEMBER", is_active=True))
    db.flush()
    return u


def _auth(user):
    return {"Authorization": f"Bearer {create_access_token({'sub': user.username})}"}


def _abrir_caja(db, org, branch, user, opening="100.00"):
    s = CashSession(user_id=user.id, branch_id=branch.id, organization_id=org.id,
                     opening_balance=Decimal(opening), status="OPEN")
    db.add(s); db.commit(); db.refresh(s)
    return s


def test_otro_cajero_no_puede_corregir_el_fondo_de_otra_persona(
    client, db, org, branch_a, branch_b, cajero_a, auth_cajero_a
):
    """Otro CAJERO, incluso de otra sucursal, recibe 403 (no 200/404)."""
    sesion = _abrir_caja(db, org, branch_a, cajero_a)
    intruso = _make_user(db, org, branch_b, "cajero_intruso", Role.CAJERO)

    resp = client.patch(
        f"/api/cash/sessions/{sesion.id}/opening-balance",
        json={"opening_balance": "500.00", "reason": "intento no autorizado"},
        headers={**_auth(intruso), "X-Organization-ID": str(org.id)},
    )
    assert resp.status_code == 403, resp.text

    db.refresh(sesion)
    assert sesion.opening_balance == Decimal("100.00"), (
        "el fondo no debe haber cambiado tras un intento no autorizado"
    )


def test_el_dueno_del_turno_si_puede_corregir_su_propio_fondo(
    client, db, org, branch_a, cajero_a, auth_cajero_a
):
    sesion = _abrir_caja(db, org, branch_a, cajero_a)

    resp = client.patch(
        f"/api/cash/sessions/{sesion.id}/opening-balance",
        json={"opening_balance": "250.00", "reason": "fondo mal capturado"},
        headers={**auth_cajero_a, "X-Organization-ID": str(org.id)},
    )
    assert resp.status_code == 200, resp.text


def test_gerente_de_la_organizacion_si_puede_corregir_el_fondo(
    client, db, org, branch_a, cajero_a, gerente_a, auth_gerente_a
):
    sesion = _abrir_caja(db, org, branch_a, cajero_a)

    resp = client.patch(
        f"/api/cash/sessions/{sesion.id}/opening-balance",
        json={"opening_balance": "250.00", "reason": "correccion supervisada"},
        headers={**auth_gerente_a, "X-Organization-ID": str(org.id)},
    )
    assert resp.status_code == 200, resp.text
