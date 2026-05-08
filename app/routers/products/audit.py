"""``GET /api/products/{id}/audit-log`` — PBS audit timeline for a product.

Sprint 5b split — extracted verbatim from the original ``products.py``.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.database import get_db
from app.core.tenant_context import get_current_active_organization
from app.models import Product, User
from app.core.security import get_current_user
from app.crud.products import _is_admin

router = APIRouter()


@router.get("/{product_id}/audit-log")
def get_product_audit_log(
    product_id: str,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    org_id: int = Depends(get_current_active_organization),
):
    """
    Devuelve el timeline de auditoría asociado a un producto: todas las
    mutaciones PBS que afectaron sus variantes (PBS_UPDATE, PBS_BULK_TOGGLE,
    PBS_BULK_CREATE).

    Track 3: cajero también puede consultar el audit log de productos
    visibles en su sucursal — ver quién modificó qué para gobernanza.
    Respeta tenancy (producto debe pertenecer a la org activa).
    """
    from ._shared import _PRODUCT_ADVANCED_ROLES
    if current_user.role not in _PRODUCT_ADVANCED_ROLES:
        raise HTTPException(status_code=403, detail="No autorizado")

    prod = db.query(Product).filter(
        Product.id == product_id,
        Product.organization_id == org_id,
    ).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    from app.models.platform import PlatformAuditLog
    from app.models.users import User as UserModel

    variant_ids = [v.id for v in prod.variants]
    if not variant_ids:
        return {"items": []}

    # Payload contiene `"variant_id": "<uuid>"` — filtro por LIKE sobre
    # cualquiera de los variant ids del producto.
    like_clauses = [PlatformAuditLog.payload.like(f'%"variant_id": "{vid}"%') for vid in variant_ids]

    rows = (
        db.query(PlatformAuditLog, UserModel.username)
        .outerjoin(UserModel, PlatformAuditLog.actor_user_id == UserModel.id)
        .filter(
            PlatformAuditLog.entity_type == "ProductBranchStatus",
            or_(*like_clauses),
        )
        .order_by(PlatformAuditLog.id.desc())
        .limit(max(1, min(limit, 200)))
        .all()
    )

    import json as _json

    items = []
    for log, username in rows:
        try:
            payload = _json.loads(log.payload) if log.payload else {}
        except Exception:
            payload = {"raw": log.payload}
        items.append({
            "id": log.id,
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "actor_username": username,
            "actor_user_id": log.actor_user_id,
            "created_at": log.created_at.isoformat() if log.created_at else None,
            "payload": payload,
        })

    return {"items": items}
