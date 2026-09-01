"""Avisos de plataforma vistos por el inquilino.

El CRUD vive en ``app/routers/platform/announcements.py``, dentro del paquete
``/api/platform/*``, que está entero detrás de ``require_platform_admin``. Los
usuarios de un negocio —cajeras, gerentes— no pueden entrar ahí, así que el
consumidor necesita su propia ruta: sólo lectura, autenticada, y con la
organización tomada del token en vez de un parámetro.
"""
from __future__ import annotations

import json as _json
from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.tenant_context import get_current_active_organization
from app.models.organization import Organization
from app.models.platform import PlatformAnnouncement

router = APIRouter()


def _targets(row: PlatformAnnouncement) -> Dict[str, Any]:
    if not row.targets_json:
        return {}
    try:
        return _json.loads(row.targets_json) or {}
    except (ValueError, TypeError):
        return {}


def _aplica(row: PlatformAnnouncement, org: Organization | None) -> bool:
    """Un aviso sin segmentación es universal; con ella, debe coincidir."""
    t = _targets(row)
    industries = t.get("industries") or []
    plans = t.get("plans") or []
    ids = t.get("org_ids") or []
    if not industries and not plans and not ids:
        return True
    if org is None:
        return False
    if ids and org.id in ids:
        return True
    if industries and org.industry_type:
        actual = getattr(org.industry_type, "value", None) or str(org.industry_type)
        if actual in industries:
            return True
    if plans and (org.plan or "FREE") in plans:
        return True
    return False


@router.get("/active")
def avisos_activos(
    db: Session = Depends(get_db),
    org_id: int = Depends(get_current_active_organization),
) -> List[Dict[str, Any]]:
    """Avisos publicados y vigentes que aplican a la organización del usuario.

    La organización la resuelve ``get_current_active_organization``, la
    dependencia canónica de multi-tenencia. Un ``org_id`` en la cadena de
    consulta se ignora a propósito: nadie debe poder leer los avisos de otro
    negocio cambiando un parámetro.
    """
    ahora = datetime.now(timezone.utc)
    filas = (
        db.query(PlatformAnnouncement)
        .filter(
            PlatformAnnouncement.published_at.isnot(None),
            PlatformAnnouncement.published_at <= ahora,
        )
        .filter(
            (PlatformAnnouncement.expires_at.is_(None))
            | (PlatformAnnouncement.expires_at > ahora)
        )
        .order_by(PlatformAnnouncement.published_at.desc())
        .all()
    )

    org = db.query(Organization).filter(Organization.id == org_id).first()

    return [
        {
            "id": f.id,
            "title": f.title,
            "body_md": f.body_md,
            "severity": f.severity or "info",
            "published_at": f.published_at.isoformat() if f.published_at else None,
            "expires_at": f.expires_at.isoformat() if f.expires_at else None,
        }
        for f in filas
        if _aplica(f, org)
    ]
