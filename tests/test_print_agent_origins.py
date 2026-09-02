"""Tests: origenes que acepta el agente de impresion local.

Atlas ONE dejo de servirse solo desde `*.up.railway.app`: la produccion vive
en `app.atlasone.com.mx`. Si el patron del agente no cubre el dominio propio,
el navegador bloquea la peticion y **no salen los tickets**, que para una
tienda equivale a no poder vender.
"""
import re

import pytest


def _regex():
    ruta = "tools/print_agent/core/main.py"
    with open(ruta, encoding="utf-8") as fh:
        codigo = fh.read()
    bloque = re.search(r"allow_origin_regex=\((?P<b>.*?)\),", codigo, re.S)
    if bloque:
        partes = re.findall(r'r"([^"]+)"', bloque.group("b"))
        return re.compile("".join(partes))
    m = re.search(r'allow_origin_regex=r"(?P<p>[^"]+)"', codigo)
    assert m, "no se encontro allow_origin_regex en el agente"
    return re.compile(m.group("p"))


ACEPTADOS = [
    "https://app.atlasone.com.mx",
    "https://demo.atlasone.com.mx",
    "https://atlasone.com.mx",
    "https://atlas-one.up.railway.app",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
]

RECHAZADOS = [
    "https://atlasone.com.mx.evil.net",
    "https://malicioso.com",
    "http://app.atlasone.com.mx.attacker.io",
]


@pytest.mark.parametrize("origen", ACEPTADOS)
def test_origenes_aceptados(origen):
    assert _regex().fullmatch(origen), f"{origen} deberia aceptarse"


@pytest.mark.parametrize("origen", RECHAZADOS)
def test_origenes_rechazados(origen):
    assert not _regex().fullmatch(origen), f"{origen} NO deberia aceptarse"


# ── Nombre de la cola de impresión ───────────────────────────────────────────

def _queue_re():
    ruta = "tools/print_agent/core/main.py"
    with open(ruta, encoding="utf-8") as fh:
        codigo = fh.read()
    m = re.search(r"_QUEUE_NAME_RE = re\.compile\(\s*r\"(?P<p>[^\"]+)\"", codigo)
    assert m, "no se encontro _QUEUE_NAME_RE"
    return re.compile(m.group("p")), codigo


def test_el_nombre_de_cola_se_valida_con_fullmatch():
    """`match` + `$` deja pasar un salto de línea final.

    `$` casa justo antes de un '\\n' de cierre sin consumirlo, así que
    "POS-80\\n" pasaba la validación pese a que el docstring afirma rechazar
    saltos de línea. `fullmatch` exige consumir la cadena completa.
    """
    _, codigo = _queue_re()
    assert "_QUEUE_NAME_RE.fullmatch(" in codigo, (
        "la validación debe usar fullmatch, no match"
    )


@pytest.mark.parametrize("nombre", ["POS-80\n", "POS-80\r\n", "POS-80\n; rm -rf /"])
def test_rechaza_nombre_con_salto_de_linea(nombre):
    patron, _ = _queue_re()
    assert not patron.fullmatch(nombre), f"{nombre!r} no deberia aceptarse"


# El patron de atlas-one es a proposito mas estrecho que el del origen: aqui
# el agente no soporta Bluetooth (BT:) ni rutas UNC, asi que no hay razon
# para aceptar esos nombres.
@pytest.mark.parametrize("nombre", ["POS-80", "EPSON TM-T20 (Copia 1)", "Caja_1.principal"])
def test_acepta_nombres_validos(nombre):
    patron, _ = _queue_re()
    assert patron.fullmatch(nombre), f"{nombre!r} deberia aceptarse"
