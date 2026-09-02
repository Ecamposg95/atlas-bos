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
