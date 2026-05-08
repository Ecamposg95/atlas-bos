from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional, Tuple
from app.core.database import get_db
from app.models import SalesDocument, User, SalesLineItem, ProductVariant, SaleReturn, SaleReturnItem
from app.models.print_job import PrintJob, PrintJobStatus
from app.core.security import get_current_user
from app.core.tenant_context import get_current_active_organization
from app.pos_printer import PosPrinter
from app.routers.sales import _assert_sale_branch_access
import base64
import io
import traceback
import zipfile
from pathlib import Path

router = APIRouter()


def _resolve_printer(current_user: User, organization) -> Tuple[PosPrinter, Optional[str]]:
    """Resolve printer config para construir bytes ESC/POS.

    Track 4 (POS bug-fix): el printer.printer_name solo se usa como **hint**
    para `paper_width_mm`. La impresión real ocurre 100% en el agente local
    de cada PC (cada cajero puede tener N PCs con N impresoras distintas);
    el server-side print mode quedó deprecado.

    Returns (PosPrinter instance, raw target name preserved for response only).
    """
    target = None
    if current_user.branch and current_user.branch.printer_name:
        target = current_user.branch.printer_name
    elif organization and organization.printer_name:
        target = organization.printer_name
    p_name = target or "POS-80"
    branch_width = getattr(current_user.branch, 'paper_width_mm', None) if current_user.branch else None
    width = branch_width if branch_width in (58, 80) else (58 if "58" in p_name else 80)
    return PosPrinter(printer_name=p_name, paper_width_mm=width), target


def _device_info(request: Request) -> dict:
    """Extrae device_id / fingerprint / client_ip de headers (Track 4)."""
    return {
        "device_id": request.headers.get("X-Device-ID"),
        "device_fingerprint": request.headers.get("X-Device-Fingerprint"),
        "client_ip": request.client.host if request.client else None,
    }


def _record_print_job(db: Session, *, raw_bytes: bytes, printer_name: Optional[str],
                      org_id: int, request: Request) -> PrintJob:
    """Crea un PrintJob con device tracking. Track 4: estado siempre PRINTED
    porque el server no imprime — solo registra que entregó los bytes al
    agente local. Si el agente local falla, el frontend reporta separado."""
    info = _device_info(request)
    job = PrintJob(
        printer_name=printer_name,
        content=base64.b64encode(raw_bytes).decode('utf-8'),
        status=PrintJobStatus.PRINTED,
        organization_id=org_id,
        device_id=info["device_id"],
        device_fingerprint=info["device_fingerprint"],
        client_ip=info["client_ip"],
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


@router.post("/test-print")
def test_print_endpoint(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    org_id: int = Depends(get_current_active_organization)
):
    """Track 4: siempre retorna base64. El agente local de cada PC imprime."""
    from app.models.organization import Organization
    organization = db.query(Organization).filter(Organization.id == org_id).first()
    printer, target_printer_name = _resolve_printer(current_user, organization)
    try:
        raw_bytes = printer.build_test_ticket_bytes(organization, branch=current_user.branch)
    except Exception as e:
        raise HTTPException(500, f"Error building test ticket: {str(e)}")
    job = _record_print_job(db, raw_bytes=raw_bytes, printer_name=printer.printer_name,
                            org_id=org_id, request=request)
    return {
        "status": "ready_to_print",
        "job_id": job.id,
        "content_base64": base64.b64encode(raw_bytes).decode('utf-8'),
        "printer_target": target_printer_name,
    }


class PrintRequest(BaseModel):
    order_id: str
    # `mode` ignored — Track 4 deprecó server-side print. Mantenido en el
    # schema para backward-compat con clientes viejos.
    mode: str = "return_base64"


@router.get("/download-agent")
def download_print_agent(
    platform: str = "windows",  # 'windows' | 'linux' | 'mac'
    current_user: User = Depends(get_current_user)
):
    """Descarga el Agente Local de Impresión como ZIP, filtrado por plataforma."""
    agent_dir = Path(__file__).parent.parent.parent / "tools" / "print_agent"
    if not agent_dir.exists():
        raise HTTPException(status_code=404, detail="Agente no encontrado en el servidor.")

    plat = platform.lower()
    if plat not in ("windows", "linux", "mac"):
        raise HTTPException(status_code=400, detail="platform debe ser 'windows', 'linux' o 'mac'")

    ALWAYS_EXCLUDE_DIRS = {"certs", "__pycache__", "venv", "venv_v2"}
    ALWAYS_EXCLUDE_SUFFIXES = {".pyc"}
    ALWAYS_EXCLUDE_FILES: set[str] = set()

    # Launcher por plataforma — los demás se excluyen para no confundir al usuario.
    if plat == "windows":
        platform_exclude = {
            "impresora_linux.sh", "impresora_mac.sh",
            "requirements_linux.txt", "requirements_mac.txt",
            "atlas-print-agent.service", "atlas-print-agent.desktop",
            "instalar-servicio-linux.sh", "INSTALL_LINUX.txt",
        }
    elif plat == "mac":
        platform_exclude = {
            "impresora_win.bat", "impresora_linux.sh",
            "requirements_linux.txt",
            "atlas-print-agent.service", "atlas-print-agent.desktop",
            "instalar-servicio-linux.sh", "INSTALL_LINUX.txt",
        }
    else:  # linux
        platform_exclude = {
            "impresora_win.bat", "impresora_mac.sh",
            "requirements_mac.txt",
        }

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for file in agent_dir.rglob("*"):
            if not file.is_file():
                continue
            if any(part in ALWAYS_EXCLUDE_DIRS for part in file.parts):
                continue
            if file.suffix in ALWAYS_EXCLUDE_SUFFIXES:
                continue
            if file.name in ALWAYS_EXCLUDE_FILES or file.name in platform_exclude:
                continue
            zf.write(file, file.relative_to(agent_dir.parent))
    buf.seek(0)

    filename = f"atlas_print_agent_{plat}.zip"
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/printers")
def get_printers(
    current_user: User = Depends(get_current_user),
    org_id: int = Depends(get_current_active_organization),
):
    """List available printers (Virtual/Cloud). Requires authentication."""
    return PosPrinter.get_available_printers()


@router.post("/print-ticket")
def print_ticket_endpoint(
    req: PrintRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    org_id: int = Depends(get_current_active_organization),
):
    """Track 4: genera bytes ESC/POS y los retorna en base64. El agente
    local de la PC del cajero los envía a su impresora física."""
    sale = db.query(SalesDocument).filter(SalesDocument.id == req.order_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    if sale.organization_id != org_id:
        raise HTTPException(status_code=403, detail="Sin acceso a esta venta")
    _assert_sale_branch_access(sale, current_user)

    from app.models.organization import Organization
    organization = db.query(Organization).filter(Organization.id == org_id).first()
    printer, target_printer_name = _resolve_printer(current_user, organization)

    try:
        payments_detail = [{"method": p.method, "amount": float(p.amount), "reference": p.reference or ""} for p in sale.payments]
        has_cash = any((p.method or "").upper() in {"CASH", "EFECTIVO"} for p in sale.payments)
        branch_opens_drawer = bool(getattr(sale.branch, "open_drawer_on_print", False))
        raw_bytes = printer.build_ticket_bytes(
            sale=sale,
            cashier=current_user.username,
            organization=organization,
            branch=sale.branch,
            paid=sum(float(p.amount) for p in sale.payments),
            change=abs(sum(float(p.amount) for p in sale.payments) - float(sale.total_amount)),
            method=sale.payments[0].method if sale.payments else "PENDING",
            is_reprint=False,
            returns=[r for r in sale.returns if r.status == 'APPROVED'],
            payments_detail=payments_detail,
            open_drawer=branch_opens_drawer and has_cash,
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

    job = _record_print_job(db, raw_bytes=raw_bytes, printer_name=printer.printer_name,
                            org_id=org_id, request=request)
    return {
        "status": "ready_to_print",
        "job_id": job.id,
        "content_base64": base64.b64encode(raw_bytes).decode('utf-8'),
        "printer_target": target_printer_name,
    }


@router.post("/reprint-ticket/{order_id}")
def reprint_ticket_endpoint(
    order_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    org_id: int = Depends(get_current_active_organization),
):
    """Track 4: reimpresión sin restricción. Siempre retorna base64."""
    from sqlalchemy.orm import joinedload, selectinload
    sale = db.query(SalesDocument).options(
        joinedload(SalesDocument.lines).joinedload(SalesLineItem.variant),
        joinedload(SalesDocument.payments),
        selectinload(SalesDocument.returns).selectinload(SaleReturn.items).joinedload(SaleReturnItem.variant).joinedload(ProductVariant.product),
        joinedload(SalesDocument.branch)
    ).filter(SalesDocument.id == order_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    if sale.organization_id != org_id:
        raise HTTPException(status_code=403, detail="Sin acceso a esta venta")
    _assert_sale_branch_access(sale, current_user)

    if hasattr(sale, 'reprint_count'):
        sale.reprint_count += 1
        db.commit()

    from app.models.organization import Organization
    organization = db.query(Organization).filter(Organization.id == org_id).first()
    printer, target_printer_name = _resolve_printer(current_user, organization)

    total_paid = sum(float(p.amount) for p in sale.payments)
    change = total_paid - float(sale.total_amount)
    if change < 0:
        change = 0.0
    method = sale.payments[0].method if sale.payments else "MIXTO"

    try:
        reprint_payments_detail = [{"method": p.method, "amount": float(p.amount), "reference": p.reference or ""} for p in sale.payments]
        raw_bytes = printer.build_ticket_bytes(
            sale=sale, paid=total_paid, change=change, method=method,
            cashier=current_user.username, is_reprint=True,
            organization=organization, branch=sale.branch,
            returns=[r for r in sale.returns if r.status == 'APPROVED'],
            payments_detail=reprint_payments_detail,
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error de reimpresión: {str(e)}")

    job = _record_print_job(db, raw_bytes=raw_bytes, printer_name=printer.printer_name,
                            org_id=org_id, request=request)
    return {
        "status": "ready_to_print",
        "job_id": job.id,
        "content_base64": base64.b64encode(raw_bytes).decode('utf-8'),
        "printer_target": target_printer_name,
        "reprint_count": getattr(sale, 'reprint_count', 'N/A'),
    }


@router.post("/reprint-refunded/{order_id}")
def reprint_refunded_endpoint(
    order_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    org_id: int = Depends(get_current_active_organization),
):
    """Track 4: ticket actualizado tras devoluciones. Siempre base64."""
    from sqlalchemy.orm import joinedload, selectinload
    sale = db.query(SalesDocument).options(
        joinedload(SalesDocument.lines).joinedload(SalesLineItem.variant),
        joinedload(SalesDocument.branch),
        selectinload(SalesDocument.returns).selectinload(SaleReturn.items).joinedload(SaleReturnItem.variant).joinedload(ProductVariant.product)
    ).filter(SalesDocument.id == order_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    if sale.organization_id != org_id:
        raise HTTPException(status_code=403, detail="Sin acceso a esta venta")
    _assert_sale_branch_access(sale, current_user)

    from app.models.organization import Organization
    organization = db.query(Organization).filter(Organization.id == org_id).first()
    printer, target_printer_name = _resolve_printer(current_user, organization)

    try:
        raw_bytes = printer.build_reissued_ticket_bytes(
            sale=sale,
            cashier=current_user.username,
            organization=organization,
            branch=sale.branch,
            returns=[r for r in sale.returns if r.status == 'APPROVED']
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

    job = _record_print_job(db, raw_bytes=raw_bytes, printer_name=printer.printer_name,
                            org_id=org_id, request=request)
    return {
        "status": "ready_to_print",
        "job_id": job.id,
        "content_base64": base64.b64encode(raw_bytes).decode('utf-8'),
        "printer_target": target_printer_name,
    }


class PrintCashCutRequest(BaseModel):
    session_id: int
    # Track 4: `mode` ignorado (deprecated). Siempre return_base64.
    mode: str = "return_base64"


@router.post("/print-cash-cut")
def print_cash_cut_endpoint(
    req: PrintCashCutRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    org_id: int = Depends(get_current_active_organization)
):
    """Track 4: corte de caja siempre en base64."""
    from app.routers.cash import get_session_audit_data, _verify_session_access
    _verify_session_access(db, req.session_id, current_user)
    audit_data = get_session_audit_data(db, req.session_id)
    if not audit_data:
        raise HTTPException(404, "Sesión no encontrada")

    from app.models.organization import Organization
    organization = db.query(Organization).filter(Organization.id == org_id).first()
    printer, target_printer_name = _resolve_printer(current_user, organization)

    try:
        raw_bytes = printer.build_cash_cut_bytes(audit_data)
    except Exception as e:
        raise HTTPException(500, f"Error impresión: {str(e)}")

    job = _record_print_job(db, raw_bytes=raw_bytes, printer_name=printer.printer_name,
                            org_id=org_id, request=request)
    return {
        "status": "ready_to_print",
        "job_id": job.id,
        "content_base64": base64.b64encode(raw_bytes).decode('utf-8'),
        "printer_target": target_printer_name,
        "session_id": req.session_id,
    }
