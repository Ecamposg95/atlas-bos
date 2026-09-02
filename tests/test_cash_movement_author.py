"""Todo movimiento de caja debe saber quien lo creo.

`cash_movements` no tenia columna de autor y POST /movements no escribia
auditoria: por esa ruta, quien saco el dinero era irrecuperable.

Ronda de correcciones 1: `approve_return` (app/crud/returns.py) tambien
crea un CashMovement OUT (la salida de efectivo del reembolso) y se habia
quedado fuera del alcance original — cada devolucion en efectivo nacia
con autor NULL. No es una fila historica, es un agujero que se sigue
llenando. Se corrige aqui junto con su prueba.
"""
from decimal import Decimal

from app.crud import returns as crud_returns
from app.models.cash import CashMovement, CashSession
from app.models.cash_audit import CashAuditLog
from app.models.sales import DocumentStatus, PaymentMethod, SalesDocument, SalesLineItem
from app.schemas.returns import SaleReturnCreate


def _abrir_caja(db, org, branch, user):
    s = CashSession(user_id=user.id, branch_id=branch.id, organization_id=org.id,
                    opening_balance=Decimal("1000"), status="OPEN")
    db.add(s); db.commit(); db.refresh(s)
    return s


class TestAutoriaDeMovimientos:
    def test_la_salida_guarda_el_autor(self, client, db, org, branch_a, cajero_a, auth_cajero_a):
        _abrir_caja(db, org, branch_a, cajero_a)
        resp = client.post(
            "/api/cash/outflow?amount=100&reason=compra de material de limpieza",
            headers={**auth_cajero_a, "X-Organization-ID": str(org.id)},
        )
        assert resp.status_code == 200, resp.text
        mv = db.query(CashMovement).one()
        assert mv.created_by_user_id == cajero_a.id

    def test_movements_tambien_audita(self, client, db, org, branch_a, cajero_a, auth_cajero_a):
        sesion = _abrir_caja(db, org, branch_a, cajero_a)
        resp = client.post(
            "/api/cash/movements",
            # `session_id` es obligatorio en CashMovementCreate (app/schemas/cash.py);
            # el brief lo omitia y el endpoint respondia 422 antes de llegar a
            # nuestro codigo. Se agrega aqui porque es un requisito preexistente
            # del schema, no algo que esta tarea deba tocar.
            json={
                "session_id": sesion.id,
                "type": "OUT",
                "amount": "100.00",
                "concept": "compra de material de limpieza",
            },
            headers={**auth_cajero_a, "X-Organization-ID": str(org.id)},
        )
        assert resp.status_code in (200, 201), resp.text
        mv = db.query(CashMovement).one()
        assert mv.created_by_user_id == cajero_a.id
        assert db.query(CashAuditLog).filter(CashAuditLog.session_id == sesion.id).count() >= 1

    def test_reembolso_en_efectivo_guarda_al_supervisor_que_aprobo(
        self, db, org, branch_a, cajero_a, gerente_a, products_setup
    ):
        """approve_return crea un CashMovement OUT propio (la salida del
        reembolso) que no pasa por app/routers/cash.py. `supervisor_id` es
        quien aprueba la devolucion y por tanto quien autoriza la salida de
        efectivo — debe quedar como autor del movimiento, no quien la creo.

        Ronda de correcciones 2: la venta y la devolucion las crea
        `cajero_a`, pero quien APRUEBA (y por tanto autoriza la salida) es
        `gerente_a` — roles distintos a proposito. Si los tres roles fueran
        el mismo usuario, la prueba pasaria igual con `db_return.user_id`
        en vez de `supervisor_id`, que es justo la distincion que protege.
        Por eso la aserción también verifica explícitamente que el autor
        NO es `cajero_a.id`.

        El reembolso en CASH exige sesion de caja abierta del aprobador en
        la sucursal de la devolucion (ver prioridad de asignacion en
        approve_return); se abre a nombre de `gerente_a`, quien aprueba.
        """
        _, variant = products_setup["product_a"]

        venta = SalesDocument(
            organization_id=org.id, branch_id=branch_a.id, seller_id=cajero_a.id,
            folio=1, series="A",
            subtotal=Decimal("100.00"), tax_amount=Decimal("0"), total_amount=Decimal("100.00"),
            status=DocumentStatus.PAID, doc_type="ORDER",
        )
        db.add(venta); db.flush()
        db.add(SalesLineItem(
            document_id=venta.id, variant_id=variant.id, description="Producto",
            quantity=2, unit_price=Decimal("50.00"), total_line=Decimal("100.00"),
            organization_id=org.id,
        ))
        db.commit(); db.refresh(venta)

        # Sesion de caja del APROBADOR (gerente_a), no de quien crea la
        # devolucion — approve_return busca la sesion OPEN de supervisor_id.
        _abrir_caja(db, org, branch_a, gerente_a)

        devolucion = crud_returns.create_return(
            db=db,
            return_in=SaleReturnCreate(
                sale_id=venta.id,
                reason="prueba de autoria en reembolso",
                total_refunded=Decimal("50.00"),
                refund_method=PaymentMethod.CASH,
                items=[{"variant_id": variant.id, "quantity": 1, "refund_amount": Decimal("50.00")}],
            ),
            user_id=cajero_a.id, branch_id=branch_a.id, organization_id=org.id,
        )
        crud_returns.approve_return(db, devolucion.id, supervisor_id=gerente_a.id, organization_id=org.id)

        mv = db.query(CashMovement).filter(CashMovement.type == "OUT").one()
        assert mv.created_by_user_id == gerente_a.id
        assert mv.created_by_user_id != cajero_a.id
