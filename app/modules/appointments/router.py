"""Atlas BOS modules/appointments/router — stub.

STATUS: Beta (placeholder). Only exposes /health for now.
Real endpoints land when this module is built out.
"""
from fastapi import APIRouter, Depends
from app.core.security import get_current_user
from app.models import User

router = APIRouter()


@router.get("/health")
def health(current_user: User = Depends(get_current_user)):
    return {"module": "appointments", "status": "beta", "ready": False}
