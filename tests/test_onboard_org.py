"""Tests: alta de una organizacion cliente (scripts/onboard_org.py)."""
import importlib

import pytest

from app.models.organization import Branch, Organization
from app.modules.users.models import User, UserOrganization

on = importlib.import_module("scripts.onboard_org")


DATOS = dict(
    name="Novedades Prueba",
    industry="ATLAS_POS",
    branch_name="HQ - Novedades Prueba",
    admin_username="prueba_admin",
    password="una-contrasena-de-prueba",
    plan="FREE",
)


class TestOnboard:
    def test_crea_organizacion_sucursal_y_admin(self, db):
        r = on.onboard(db, **DATOS)

        org = db.query(Organization).filter(Organization.name == "Novedades Prueba").one()
        assert org.industry_type.value == "ATLAS_POS"
        assert org.plan == "FREE"
        assert org.status == "ACTIVE"
        assert r["organization_id"] == org.id

        sucursal = db.query(Branch).filter(Branch.organization_id == org.id).one()
        assert sucursal.name == "HQ - Novedades Prueba"
        assert sucursal.is_headquarters is True
        assert sucursal.can_sell is True

        admin = db.query(User).filter(User.username == "prueba_admin").one()
        assert admin.role.value == "ADMINISTRADOR"
        assert admin.platform_role.value == "NONE", "un admin de cliente no es de plataforma"
        assert admin.branch_id == sucursal.id

        enlace = db.query(UserOrganization).filter(
            UserOrganization.user_id == admin.id,
            UserOrganization.organization_id == org.id,
        ).one()
        assert enlace.org_role == "ADMIN"

    def test_el_admin_puede_iniciar_sesion_con_su_contrasena(self, client, db):
        on.onboard(db, **DATOS)
        resp = client.post(
            "/api/auth/login",
            data={"username": "prueba_admin", "password": "una-contrasena-de-prueba"},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        assert resp.status_code == 200, resp.text
        assert resp.json().get("access_token")

    def test_no_usa_la_contrasena_de_las_demo(self, client, db):
        on.onboard(db, **DATOS)
        resp = client.post(
            "/api/auth/login",
            data={"username": "prueba_admin", "password": "demo1234"},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        assert resp.status_code != 200

    def test_es_idempotente(self, db):
        primera = on.onboard(db, **DATOS)
        segunda = on.onboard(db, **DATOS)
        assert primera["organization_id"] == segunda["organization_id"]
        assert segunda["created"] is False
        assert db.query(Organization).filter(Organization.name == "Novedades Prueba").count() == 1
        assert db.query(Branch).filter(Branch.organization_id == primera["organization_id"]).count() == 1
        assert db.query(User).filter(User.username == "prueba_admin").count() == 1

    def test_genera_contrasena_si_no_se_da(self, db):
        datos = {**DATOS, "password": None}
        r = on.onboard(db, **datos)
        assert r["password"] is not None
        assert len(r["password"]) >= 16
        assert r["password"] != "demo1234"

    def test_no_toca_otras_organizaciones(self, db, org, branch_a):
        antes = (org.name, org.industry_type, db.query(Branch).filter(Branch.organization_id == org.id).count())
        on.onboard(db, **DATOS)
        db.refresh(org)
        despues = (org.name, org.industry_type, db.query(Branch).filter(Branch.organization_id == org.id).count())
        assert antes == despues

    def test_giro_invalido_es_error_claro(self, db):
        with pytest.raises(ValueError, match="giro"):
            on.onboard(db, **{**DATOS, "industry": "NO_EXISTE"})
