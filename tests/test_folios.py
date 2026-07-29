"""Tests de generación de folios — app/utils/folios.py.

Cubre la secuencia por (sucursal, serie) y la regresión del race condition:
el folio debe ser estrictamente creciente y no repetirse dentro de una serie.
"""
from app.utils.folios import get_next_folio
from app.models import SalesDocument


def _make_sale(db, branch_id, series, folio, org_id, seller_id):
    doc = SalesDocument(
        doc_type="INVOICE",
        status="PAID",
        branch_id=branch_id,
        seller_id=seller_id,
        series=series,
        folio=folio,
        subtotal=0,
        tax_amount=0,
        total_amount=0,
        organization_id=org_id,
    )
    db.add(doc)
    db.flush()
    return doc


def test_primer_folio_es_1(db, branch_a, org):
    assert get_next_folio(db, branch_id=branch_a.id, series="A") == 1


def test_folio_incrementa_sobre_el_maximo(db, branch_a, org, cajero_a):
    _make_sale(db, branch_a.id, "A", 1, org.id, cajero_a.id)
    _make_sale(db, branch_a.id, "A", 2, org.id, cajero_a.id)
    assert get_next_folio(db, branch_id=branch_a.id, series="A") == 3


def test_series_distintas_no_comparten_contador(db, branch_a, org, cajero_a):
    _make_sale(db, branch_a.id, "A", 7, org.id, cajero_a.id)
    # La serie Q arranca en 1 aunque A ya vaya en 7.
    assert get_next_folio(db, branch_id=branch_a.id, series="Q") == 1


def test_sucursales_distintas_no_comparten_contador(db, branch_a, branch_b, org, cajero_a):
    _make_sale(db, branch_a.id, "A", 5, org.id, cajero_a.id)
    assert get_next_folio(db, branch_id=branch_b.id, series="A") == 1


def test_secuencia_sin_huecos_ni_repetidos(db, branch_a, org, cajero_a):
    """Emular checkout secuencial: cada folio se materializa antes del siguiente.

    Antes del fix, leer el folio sin persistirlo devolvía siempre el mismo número;
    aquí verificamos que asignar-y-persistir produce 1..N sin repetir.
    """
    emitidos = []
    for _ in range(10):
        f = get_next_folio(db, branch_id=branch_a.id, series="A")
        _make_sale(db, branch_a.id, "A", f, org.id, cajero_a.id)
        emitidos.append(f)
    assert emitidos == list(range(1, 11))
    assert len(set(emitidos)) == 10
