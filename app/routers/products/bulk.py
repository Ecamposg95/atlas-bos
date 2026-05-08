"""``POST /api/products/batch-action`` — bulk activate / deactivate / approve.

Sprint 5b split — extracted verbatim from the original ``products.py``.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_active_organization
from app.models import Product, User
from app.security import get_current_user
from app.crud.products import _is_admin
from app.schemas.products import BatchActionRequest

router = APIRouter()


# -----------------------------
# 5. Batch Actions
# -----------------------------
@router.post("/batch-action")
def batch_products_action(
    req: BatchActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    org_id: int = Depends(get_current_active_organization)
):
    """
    Handles bulk operations on products: delete, activate, deactivate, approve.
    Strictly scoped to current organization.

    Track 3 (POS bug-fix): el cajero tiene control avanzado del catálogo en
    su tienda. La invariante multi-tenant (Product.organization_id == org_id)
    sigue intacta — un cajero solo puede afectar productos de su organización.
    """
    from ._shared import _PRODUCT_ADVANCED_ROLES
    if current_user.role not in _PRODUCT_ADVANCED_ROLES:
        raise HTTPException(
            status_code=403,
            detail="No autorizado para acciones masivas",
        )

    q = db.query(Product).filter(
        Product.id.in_(req.ids),
        Product.organization_id == org_id
    )

    # ATS-27: Filter to rows that actually need changing so processed == real count
    if req.action == 'delete' or req.action == 'deactivate':
        processed = q.filter(Product.is_active == True).update({"is_active": False}, synchronize_session=False)

    elif req.action == 'activate':
        processed = q.filter(Product.is_active == False).update({"is_active": True}, synchronize_session=False)

    elif req.action == 'approve':
        processed = q.filter(Product.approval_status != 'APPROVED').update({"approval_status": 'APPROVED'}, synchronize_session=False)

    else:
        raise HTTPException(status_code=400, detail="Acción no válida")

    db.commit()
    if processed == 0:
        return {"status": "ok", "processed": 0, "message": "Ningún producto fue modificado (ya tenían ese estado)."}
    return {"status": "ok", "processed": processed}
