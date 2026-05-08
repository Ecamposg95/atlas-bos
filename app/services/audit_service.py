"""
Helper para escribir entradas en platform_audit_log desde cualquier endpoint.
Usa el modelo PlatformAuditLog existente (entity_type/entity_id/payload/created_at).
Meta info adicional (organization_id, ip, result) se guarda en payload JSON.

DEFENSA: si la tabla no existe (env sin migración) o cualquier otro error de DB,
el audit es NO-OP — NUNCA debe romper la operación de negocio del caller.
"""
import json
import logging
from typing import Optional, Any
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from app.models.platform import PlatformAuditLog

_log = logging.getLogger(__name__)


def write_audit(
    db: Session,
    *,
    actor_user_id: Optional[int],
    action: str,
    entity_type: str,
    entity_id: Optional[str] = None,
    organization_id: Optional[int] = None,
    ip: Optional[str] = None,
    result: str = "OK",
    meta: Optional[dict[str, Any]] = None,
) -> Optional[PlatformAuditLog]:
    """
    Intenta crear una entrada de audit log. Si falla (tabla inexistente,
    permisos, etc.), loguea warning y retorna None — NO propaga la excepción.
    El caller hace commit; si write_audit hizo flush con error, ya hicimos
    rollback aquí mismo del savepoint para no contaminar la transacción.
    """
    payload_dict = {
        "organization_id": organization_id,
        "ip": ip,
        "result": result,
    }
    if meta:
        payload_dict["meta"] = meta

    # Usamos un SAVEPOINT para que un error en el audit (tabla inexistente,
    # permisos, etc.) no contamine la transacción de negocio del caller.
    try:
        with db.begin_nested():
            log = PlatformAuditLog(
                actor_user_id=actor_user_id,
                action=action,
                entity_type=entity_type,
                entity_id=str(entity_id) if entity_id is not None else None,
                payload=json.dumps(payload_dict, default=str),
            )
            db.add(log)
            db.flush()
        return log
    except SQLAlchemyError as e:
        _log.warning(
            "audit_service.write_audit failed (action=%s entity=%s): %s — "
            "operación de negocio continúa.",
            action, entity_type, e
        )
        return None
