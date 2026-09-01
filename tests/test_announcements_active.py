"""Tests: consumo de avisos activos por parte del inquilino."""
import json
from datetime import datetime, timedelta, timezone

from app.models.platform import PlatformAnnouncement


def _publish(db, org_ids=None, title="Aviso", severity="info", expires_in_days=7):
    ann = PlatformAnnouncement(
        title=title,
        body_md="Cuerpo del aviso.",
        severity=severity,
        targets_json=json.dumps({"org_ids": org_ids}) if org_ids else None,
        published_at=datetime.now(timezone.utc) - timedelta(minutes=1),
        expires_at=datetime.now(timezone.utc) + timedelta(days=expires_in_days),
    )
    db.add(ann)
    db.commit()
    db.refresh(ann)
    return ann


class TestAnnouncementsActive:
    def test_requiere_autenticacion(self, client, db, org):
        _publish(db, org_ids=[org.id])
        resp = client.get("/api/announcements/active")
        assert resp.status_code == 401, (
            f"El endpoint debe exigir sesion, respondio {resp.status_code}"
        )

    def test_devuelve_los_avisos_de_mi_organizacion(self, client, db, org, auth_cajero_a):
        _publish(db, org_ids=[org.id], title="Actualizacion necesaria")
        resp = client.get("/api/announcements/active", headers=auth_cajero_a)
        assert resp.status_code == 200, resp.text
        titulos = [a["title"] for a in resp.json()]
        assert "Actualizacion necesaria" in titulos

    def test_no_filtra_avisos_de_otra_organizacion(self, client, db, org, auth_cajero_a):
        _publish(db, org_ids=[org.id + 999], title="Aviso ajeno")
        resp = client.get("/api/announcements/active", headers=auth_cajero_a)
        assert resp.status_code == 200, resp.text
        titulos = [a["title"] for a in resp.json()]
        assert "Aviso ajeno" not in titulos

    def test_ignora_org_id_del_parametro(self, client, db, org, auth_cajero_a):
        """El org_id ya no se acepta: la organizacion sale del token."""
        _publish(db, org_ids=[org.id + 999], title="Aviso ajeno")
        resp = client.get(
            f"/api/announcements/active?org_id={org.id + 999}",
            headers=auth_cajero_a,
        )
        assert resp.status_code == 200, resp.text
        titulos = [a["title"] for a in resp.json()]
        assert "Aviso ajeno" not in titulos

    def test_incluye_los_universales(self, client, db, org, auth_cajero_a):
        _publish(db, org_ids=None, title="Aviso universal")
        resp = client.get("/api/announcements/active", headers=auth_cajero_a)
        titulos = [a["title"] for a in resp.json()]
        assert "Aviso universal" in titulos

    def test_excluye_borradores_y_vencidos(self, client, db, org, auth_cajero_a):
        borrador = PlatformAnnouncement(
            title="Borrador", body_md="x", severity="info",
            targets_json=json.dumps({"org_ids": [org.id]}), published_at=None,
        )
        vencido = PlatformAnnouncement(
            title="Vencido", body_md="x", severity="info",
            targets_json=json.dumps({"org_ids": [org.id]}),
            published_at=datetime.now(timezone.utc) - timedelta(days=10),
            expires_at=datetime.now(timezone.utc) - timedelta(days=1),
        )
        db.add_all([borrador, vencido])
        db.commit()
        resp = client.get("/api/announcements/active", headers=auth_cajero_a)
        titulos = [a["title"] for a in resp.json()]
        assert "Borrador" not in titulos
        assert "Vencido" not in titulos
