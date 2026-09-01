"""Carga masiva de catalogo desde CSV para una organizacion y sucursal.

Crea, por cada fila: el departamento (categoria) si falta, el producto, su
variante con codigo y precios, el estado del producto en la sucursal y sus
existencias iniciales.

Idempotente por SKU dentro de la organizacion: volver a correrlo omite lo que
ya existe en vez de duplicarlo.

Columnas esperadas (las del formato que exporta el sistema):
    Nombre*, Categoria, Codigo, Descripcion, Costo unitario, Precio*,
    Mostrar en el catalogo, Controlar stock, Stock actual, Stock minimo

Uso:
    python scripts/import_products.py archivo.csv --org 15 --branch 17
    python scripts/import_products.py archivo.csv --org 15 --branch 17 --dry-run
"""
from __future__ import annotations

import argparse
import csv
import re
import sys
import unicodedata
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Dict, Optional

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import app.models  # noqa: F401  (puebla la metadata)
from app.models.inventory import StockOnHand
from app.models.products import (
    Department,
    Product,
    ProductBranchStatus,
    ProductVariant,
)


def _norm(s: Optional[str]) -> str:
    """Normaliza una cabecera: sin acentos, sin asteriscos, en minusculas."""
    s = (s or "").strip().replace("*", "")
    s = unicodedata.normalize("NFKD", s)
    return "".join(c for c in s if not unicodedata.combining(c)).lower()


CAMPOS = {
    "nombre": "nombre",
    "categoria": "categoria",
    "codigo": "codigo",
    "descripcion": "descripcion",
    "costo unitario": "costo",
    "precio": "precio",
    "mostrar en el catalogo": "visible",
    "controlar stock": "controla_stock",
    "stock actual": "stock",
    "stock minimo": "stock_min",
}


def _si(valor: Optional[str], por_omision: bool = True) -> bool:
    v = (valor or "").strip().upper()
    if not v:
        return por_omision
    return v in {"S", "SI", "SÍ", "Y", "YES", "TRUE", "1"}


def _num(valor: Optional[str], campo: str, fila: int) -> Optional[Decimal]:
    v = (valor or "").strip().replace(",", "")
    if not v:
        return None
    try:
        return Decimal(v)
    except InvalidOperation:
        raise ValueError(
            f"fila {fila}: {campo} invalido — {valor!r} no es un numero"
        ) from None


def _sku_desde_nombre(nombre: str) -> str:
    base = re.sub(r"[^A-Za-z0-9]", "", unicodedata.normalize("NFKD", nombre).upper())
    return (base[:8] or "PROD")


def _leer(ruta: str):
    with open(ruta, newline="", encoding="utf-8-sig") as fh:
        lector = csv.DictReader(fh)
        for i, cruda in enumerate(lector, start=2):  # 1 es la cabecera
            yield i, {CAMPOS[_norm(k)]: v for k, v in cruda.items() if _norm(k) in CAMPOS}


def import_products(
    db,
    ruta_csv: str,
    org_id: int,
    branch_id: int,
    dry_run: bool = False,
) -> Dict[str, Any]:
    """Carga el catalogo. Devuelve un resumen con los conteos y las incidencias."""
    resumen: Dict[str, Any] = {
        "creados": 0,
        "omitidos": 0,
        "ignorados": 0,
        "codigos_generados": 0,
        "categorias_creadas": 0,
        "incidencias": [],
    }

    # SKUs ya usados por la organizacion, para no chocar con el indice unico.
    usados = {
        s for (s,) in db.query(ProductVariant.sku)
        .filter(ProductVariant.organization_id == org_id)
        .all()
        if s
    }
    departamentos: Dict[str, Department] = {}

    def _departamento(nombre: str) -> Optional[Department]:
        clave = nombre.strip()
        if not clave:
            return None
        if clave in departamentos:
            return departamentos[clave]
        d = (
            db.query(Department)
            .filter(Department.organization_id == org_id, Department.name == clave)
            .first()
        )
        if d is None:
            d = Department(name=clave, organization_id=org_id)
            db.add(d)
            db.flush()
            resumen["categorias_creadas"] += 1
        departamentos[clave] = d
        return d

    for nfila, f in _leer(ruta_csv):
        nombre = (f.get("nombre") or "").strip()
        if not nombre:
            resumen["ignorados"] += 1
            continue

        precio = _num(f.get("precio"), "precio", nfila)
        costo = _num(f.get("costo"), "costo unitario", nfila)

        sku = (f.get("codigo") or "").strip()
        generado = False
        if not sku:
            sku = _sku_desde_nombre(nombre)
            generado = True
        if sku in usados:
            if not generado and sku == (f.get("codigo") or "").strip():
                # El codigo del archivo ya lo tiene otro producto de esta org.
                # Si el producto ya existe con ese SKU, se omite; si es un
                # codigo repetido dentro del propio archivo, se desambigua.
                existente = (
                    db.query(ProductVariant)
                    .filter(
                        ProductVariant.organization_id == org_id,
                        ProductVariant.sku == sku,
                    )
                    .join(Product, Product.id == ProductVariant.product_id)
                    .filter(Product.name == nombre)
                    .first()
                )
                if existente is not None:
                    resumen["omitidos"] += 1
                    continue
            base, n = sku, 2
            while f"{base}-{n}" in usados:
                n += 1
            sku = f"{base}-{n}"
            generado = True
        if generado:
            resumen["codigos_generados"] += 1
            resumen["incidencias"].append(
                f"fila {nfila}: '{nombre}' recibio el codigo generado {sku}"
            )
        usados.add(sku)

        dep = _departamento(f.get("categoria") or "")
        producto = Product(
            name=nombre,
            description=(f.get("descripcion") or "").strip() or None,
            organization_id=org_id,
            department_id=dep.id if dep is not None else None,
            is_active=True,
        )
        db.add(producto)
        db.flush()

        variante = ProductVariant(
            product_id=producto.id,
            sku=sku,
            price=precio,
            cost=costo,
            organization_id=org_id,
        )
        db.add(variante)
        db.flush()

        stock_min = _num(f.get("stock_min"), "stock minimo", nfila)
        db.add(
            ProductBranchStatus(
                variant_id=variante.id,
                branch_id=branch_id,
                organization_id=org_id,
                is_active_pos=True,
                is_visible=_si(f.get("visible")),
                min_stock_alert=stock_min,
            )
        )

        controla = _si(f.get("controla_stock"))
        db.add(
            StockOnHand(
                variant_id=variante.id,
                branch_id=branch_id,
                organization_id=org_id,
                qty_on_hand=_num(f.get("stock"), "stock actual", nfila) or Decimal("0"),
                is_active=controla,
            )
        )
        resumen["creados"] += 1

    if dry_run:
        db.rollback()
    else:
        db.commit()
    return resumen


def main() -> None:
    p = argparse.ArgumentParser(description="Carga de catalogo desde CSV")
    p.add_argument("csv")
    p.add_argument("--org", type=int, required=True)
    p.add_argument("--branch", type=int, required=True)
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    from app.core.database import SessionLocal

    db = SessionLocal()
    try:
        r = import_products(db, args.csv, args.org, args.branch, dry_run=args.dry_run)
    finally:
        db.close()

    print("=" * 56)
    print("ENSAYO — nada se guardo" if args.dry_run else "CARGA APLICADA")
    print(f"  creados            {r['creados']}")
    print(f"  omitidos (ya estan){r['omitidos']:>4}")
    print(f"  ignorados          {r['ignorados']}")
    print(f"  categorias creadas {r['categorias_creadas']}")
    print(f"  codigos generados  {r['codigos_generados']}")
    for inc in r["incidencias"]:
        print("   ·", inc)
    print("=" * 56)


if __name__ == "__main__":
    main()
