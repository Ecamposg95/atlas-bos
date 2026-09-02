"""
Cash reconciliation — fórmula única para `expected_cash` de una sesión de caja.

Antes vivía replicada en tres funciones distintas en `app/routers/cash.py`
(`_apply_close_to_session`, `get_session_audit_data`, `get_branch_cash_summary`)
con sutiles diferencias de cálculo. Una discrepancia silenciosa entre el
cálculo del cierre (que persiste `difference` en BD) y el del dashboard (que
muestra al cajero el esperado pre-cierre) genera cuadres "mal" cuando el
cajero contó al peso lo que la UI le mostró.

Aquí queda la versión canónica. Todos los callers consumen este servicio.

Fórmula canónica:

    expected = opening
             + (gross_cash_payments − change_given)        # net_cash
             + manual_inflows
             − manual_outflows
             − refund_cash_outflows                         # CashMovements OUT con reason 'Devolución #*'

Equivalente a `opening + net_cash + total_inflows − total_outflows`, pero
explicitando la decomposición de `total_outflows` en `manual + refund_cash`
para que el audit dashboard pueda mostrarlas separadas sin doble-contar.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, time as _time, timezone
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover — Python <3.9 fallback, ya usado en app/routers/cash.py
    from backports.zoneinfo import ZoneInfo

# Mismo huso que app/routers/cash.py y app/pos_printer.py: el "día" de negocio
# de un POS mexicano es el día calendario en America/Mexico_City, no UTC.
_MX_TZ = ZoneInfo("America/Mexico_City")

from app.models.cash import CashMovement, CashSession
from app.models.sales import (
    DocumentStatus,
    Payment,
    PaymentMethod,
    SalesDocument,
)


# Prefijo de la `reason` que `crud/returns.py` graba al aprobar un refund cash.
# Mantener en sync con `crud/returns.py:approve_return`.
REFUND_REASON_PREFIX = "Devolución #"


# Statuses that count as "cash entered the drawer".
#
# When a sale is approved as PAID, its Payment rows record what physically
# entered the drawer. If the sale is later refunded (status flips to
# REFUNDED_PARTIAL or REFUNDED_TOTAL), the Payment rows are NOT mutated —
# the original cash inflow still happened — and a separate CashMovement OUT
# is appended for the refund. Reconciliation must include all three statuses
# when summing cash inflow, otherwise the original deposit "disappears" from
# expected_cash while the refund OUT is still subtracted, producing
# negative expected_cash on days with significant refunds (especially of
# prior-day sales).
CASH_INCLUDED_STATUSES = (
    DocumentStatus.PAID,
    DocumentStatus.REFUNDED_PARTIAL,
    DocumentStatus.REFUNDED_TOTAL,
)


@dataclass
class ExpectedCashBreakdown:
    """Desglose del efectivo esperado en caja al final del turno."""

    opening: Decimal = Decimal(0)
    gross_cash: Decimal = Decimal(0)          # suma de pagos CASH en ventas PAID
    change_given: Decimal = Decimal(0)        # vuelto entregado en ventas con efectivo
    net_cash: Decimal = Decimal(0)            # gross_cash − change_given
    manual_inflows: Decimal = Decimal(0)      # CashMovement IN (cualquier reason)
    manual_outflows: Decimal = Decimal(0)     # CashMovement OUT NO-refund
    refund_cash_outflows: Decimal = Decimal(0)  # CashMovement OUT con prefijo refund
    expected: Decimal = Decimal(0)            # resultado final

    # Movimientos crudos para la UI (lista de CashMovement filtrada manualmente).
    manual_movements: List[CashMovement] = field(default_factory=list)


def session_sales_filter(session: CashSession):
    """SQL filter para asociar SalesDocument a una sesión.

    Track 1 introdujo `SalesDocument.cash_session_id`; las ventas viejas
    (creadas antes de la migración) tienen ese campo NULL. Para esas hacemos
    fallback temporal por seller + branch + rango `[opened_at, closed_at|now]`.
    """
    close_limit = session.closed_at or datetime.now(timezone.utc)
    legacy = (
        (SalesDocument.cash_session_id.is_(None))
        & (SalesDocument.seller_id == session.user_id)
        & (SalesDocument.branch_id == session.branch_id)
        & (SalesDocument.created_at >= session.opened_at)
        & (SalesDocument.created_at <= close_limit)
    )
    return or_(SalesDocument.cash_session_id == session.id, legacy)


def _compute_change_given(db: Session, session: CashSession) -> Decimal:
    """Vuelto total entregado en ventas con pago efectivo en esta sesión.

    Fase 1.3: las ventas nuevas persisten `change_given` al crearse. Para esas
    leemos del campo (consistencia garantizada). Para ventas legadas (campo
    NULL, creadas antes de la migración) recomputamos con la fórmula original:
    excedente de CASH sobre lo que el efectivo realmente tenía que cubrir.
    """
    sales = (
        db.query(SalesDocument)
        .filter(
            session_sales_filter(session),
            SalesDocument.status.in_(CASH_INCLUDED_STATUSES),
        )
        .all()
    )

    total = Decimal(0)
    for sale in sales:
        if sale.change_given is not None:
            total += Decimal(str(sale.change_given))
            continue
        # Fallback legacy (sale.change_given IS NULL).
        cash_in_sale = sum(
            (Decimal(str(p.amount)) for p in sale.payments if p.method == PaymentMethod.CASH),
            Decimal(0),
        )
        if cash_in_sale <= 0:
            continue
        non_cash = sum(
            (Decimal(str(p.amount)) for p in sale.payments if p.method != PaymentMethod.CASH),
            Decimal(0),
        )
        cash_needed = max(Decimal(0), Decimal(str(sale.total_amount)) - non_cash)
        if cash_in_sale > cash_needed:
            total += cash_in_sale - cash_needed
    return total


def _is_refund_movement(mv: CashMovement) -> bool:
    return (
        mv.type == "OUT"
        and mv.reason is not None
        and mv.reason.startswith(REFUND_REASON_PREFIX)
    )


def compute_expected_cash(db: Session, session: CashSession) -> ExpectedCashBreakdown:
    """Calcula el efectivo esperado en caja para una sesión.

    No persiste nada. No mutates `session`.
    """
    out = ExpectedCashBreakdown(opening=Decimal(str(session.opening_balance or 0)))

    # Pagos efectivo brutos (PAID) en la sesión
    cash_payments = (
        db.query(func.sum(Payment.amount))
        .join(SalesDocument)
        .filter(
            Payment.method == PaymentMethod.CASH,
            session_sales_filter(session),
            SalesDocument.status.in_(CASH_INCLUDED_STATUSES),
        )
        .scalar()
        or Decimal(0)
    )
    out.gross_cash = Decimal(str(cash_payments))

    # Cambio entregado
    out.change_given = _compute_change_given(db, session)
    out.net_cash = out.gross_cash - out.change_given

    # Movimientos: separar manuales vs refund-generados por prefijo de `reason`.
    movements = (
        db.query(CashMovement)
        .filter(CashMovement.session_id == session.id)
        .order_by(CashMovement.created_at.asc())
        .all()
    )

    manual_in = Decimal(0)
    manual_out = Decimal(0)
    refund_out = Decimal(0)
    manual_list: List[CashMovement] = []

    for mv in movements:
        amt = Decimal(str(mv.amount))
        if _is_refund_movement(mv):
            refund_out += amt
            continue
        if mv.type == "IN":
            manual_in += amt
            manual_list.append(mv)
        elif mv.type == "OUT":
            manual_out += amt
            manual_list.append(mv)

    out.manual_inflows = manual_in
    out.manual_outflows = manual_out
    out.refund_cash_outflows = refund_out
    out.manual_movements = manual_list

    out.expected = (
        out.opening
        + out.net_cash
        + out.manual_inflows
        - out.manual_outflows
        - out.refund_cash_outflows
    )
    return out


# ── Closure warnings (F2 — non-blocking signals) ────────────────────────────
#
# These flag suspicious states at close time without blocking. UI surfaces
# them to the cashier; back-office can audit. Hard blocks (cierre rechazado)
# live in `_apply_close_to_session`; here only signals.

_LARGE_DIFF_RATIO = Decimal("0.5")  # 50%


def compute_closure_warnings(
    breakdown: ExpectedCashBreakdown,
    closing_balance: Decimal,
    db: Optional[Session] = None,
    session: Optional[CashSession] = None,
) -> List[dict]:
    """Return a list of warning dicts for a closure.

    Each warning is `{code, severity, message, threshold, actual}`.
    Empty list = no warnings.

    `db` y `session` son opcionales y NO forman parte del cálculo de W1-W3
    (que solo dependen de `breakdown`/`closing_balance`, ver `_apply_close_to_session`,
    fuente única de la fórmula). Se añadieron para W4 (`SALES_WITHOUT_SESSION`),
    que necesita consultar ventas huérfanas por organización/sucursal — dato que
    `ExpectedCashBreakdown` no carga. Los callers existentes, que no los pasan,
    siguen funcionando igual: W4 simplemente no se calcula sin ellos.
    """
    warnings: List[dict] = []
    closing = Decimal(str(closing_balance or 0))
    expected = breakdown.expected
    diff = closing - expected

    # W1: refund cash outflows exceed today's gross_cash → cross-day refund
    # signature OR potential duplicate / inflated refund.
    if breakdown.refund_cash_outflows > breakdown.gross_cash:
        warnings.append({
            "code": "REFUNDS_EXCEED_TODAY_CASH",
            "severity": "warning",
            "message": (
                "Reembolsos en efectivo del día exceden el efectivo recibido. "
                "Posible devolución de venta de día anterior o monto inflado."
            ),
            "threshold": float(breakdown.gross_cash),
            "actual": float(breakdown.refund_cash_outflows),
        })

    # W2: change_given > gross_cash — mathematically impossible. Indicates
    # corrupted change_given persisted on a SalesDocument.
    if breakdown.change_given > breakdown.gross_cash:
        warnings.append({
            "code": "CHANGE_EXCEEDS_GROSS_CASH",
            "severity": "critical",
            "message": (
                "El cambio entregado excede el efectivo recibido. "
                "Esto es matemáticamente imposible — revisar las ventas con "
                "change_given mal calculado."
            ),
            "threshold": float(breakdown.gross_cash),
            "actual": float(breakdown.change_given),
        })

    # W3: |difference| / expected > 50% — large unexplained gap
    abs_expected = abs(expected) if expected != 0 else Decimal("1")
    if expected != 0 and abs(diff) / abs_expected > _LARGE_DIFF_RATIO:
        warnings.append({
            "code": "LARGE_DIFFERENCE_RATIO",
            "severity": "warning",
            "message": (
                "La diferencia entre lo esperado y lo contado supera el 50% "
                "del esperado. Recomendamos recontar antes de cerrar."
            ),
            "threshold": float(abs_expected * _LARGE_DIFF_RATIO),
            "actual": float(abs(diff)),
        })

    # W4: efectivo cobrado en esta sucursal, en el día calendario (MX) en que
    # abrió el turno, que no pertenece a NINGÚN corte (cash_session_id NULL).
    # Antes esto era invisible: ninguna pantalla expone cash_session_id, así
    # que ese dinero podía quedar fuera de todo cuadre sin que nadie lo notara.
    #
    # Ronda de correcciones 1 — tres defectos reales del primer borrador:
    #
    # 1) Filtra por CASH_INCLUDED_STATUSES (mismo criterio que
    #    `compute_expected_cash`, arriba). Sin este filtro, una venta
    #    CANCELLED con pago en efectivo disparaba la alerta: `cancel_sale`
    #    marca CANCELLED pero no borra el Payment, y ese pago no es dinero
    #    real fuera de corte — es de una venta que nunca se concretó.
    #
    # 2) Ventana = inicio del DÍA CALENDARIO en America/Mexico_City de
    #    `session.opened_at`, no el instante de apertura. Antes excluía
    #    huérfanas anteriores a la apertura — justo el caso motivador: venta
    #    a las 9am, turno abierto a las 10am, nunca se reportaba. No se
    #    amplía a "todo el histórico" para que la alerta no se vuelva ruido
    #    permanente en cada cierre: huérfanas más viejas que el día en curso
    #    son limpieza de datos, no un aviso diario.
    #
    # 3) NO filtra por vendedor/cajero: el efectivo huérfano es un hecho de
    #    LA SUCURSAL — puede venir de alguien que nunca abrió turno — y
    #    filtrarlo lo haría desaparecer. El mensaje se redacta como aviso de
    #    sucursal, no como un faltante personal de quien cierra.
    #
    # Además: `distinct` en el conteo de ventas (una venta con dos pagos
    # parciales en efectivo no debe contarse dos veces), y el mensaje ya NO
    # afirma "no está en el esperado" — el fallback legacy de
    # `session_sales_filter` (mismo vendedor + sucursal + rango) puede sumar
    # algunas de estas huérfanas al esperado de la sesión que cierra, así que
    # esa frase sería falsa para ese subconjunto.
    #
    # Requiere `db` + `session`; sin ellos (callers legacy) no se calcula.
    if db is not None and session is not None:
        opened_at = session.opened_at
        opened_mx = (
            opened_at.astimezone(_MX_TZ) if opened_at.tzinfo
            else opened_at.replace(tzinfo=timezone.utc).astimezone(_MX_TZ)
        )
        day_start_mx = datetime.combine(opened_mx.date(), _time.min, tzinfo=_MX_TZ)
        # Convertir a UTC antes de comparar: un datetime aware con offset
        # distinto de cero se compara mal contra columnas DateTime en SQLite
        # (el offset se ignora y solo se usan los campos naive), aunque en
        # Postgres (producción) sí compara por instante real. UTC evita la
        # divergencia entre motores.
        day_start_utc = day_start_mx.astimezone(timezone.utc)

        huerfanas = db.query(
            func.count(func.distinct(SalesDocument.id)),
            func.coalesce(func.sum(Payment.amount), 0),
        ).join(Payment, Payment.sales_document_id == SalesDocument.id).filter(
            SalesDocument.organization_id == session.organization_id,
            SalesDocument.branch_id == session.branch_id,
            SalesDocument.cash_session_id.is_(None),
            SalesDocument.deleted_at.is_(None),
            SalesDocument.status.in_(CASH_INCLUDED_STATUSES),
            Payment.method == PaymentMethod.CASH,
            SalesDocument.created_at >= day_start_utc,
        ).first()
        n_huerfanas, monto_huerfano = (huerfanas or (0, 0))
        if n_huerfanas:
            warnings.append({
                "code": "SALES_WITHOUT_SESSION",
                "severity": "high",
                "message": (
                    f"Hay {n_huerfanas} venta(s) en efectivo de esta sucursal, por "
                    f"{monto_huerfano}, que no pertenecen a ningún corte. Verifica que "
                    f"ese efectivo esté contabilizado antes de dar la caja por cuadrada."
                ),
            })

    return warnings
