"""Un 422 debe dejar rastro de QUE campo fallo.

Sin manejador de `RequestValidationError`, un 422 solo aparece en el log como
`POST /api/products/ 422 Unprocessable Entity`: no dice que campo se rechazo.
Cuando el usuario reporta "no me deja agregar el producto", no hay forma de
saber que le paso sin reproducirlo a ciegas.

Se registran los NOMBRES de los campos y el motivo, nunca los valores: un
payload de producto o de venta puede traer datos del negocio.
"""
import logging

import pytest


class TestRegistroDeValidacion:
    def test_un_422_registra_los_campos_que_fallaron(self, client, db, org, auth_admin, caplog):
        with caplog.at_level(logging.WARNING):
            resp = client.post(
                "/api/products/",
                json={"name": "Sin costo ni sku", "price": "25.00"},
                headers={**auth_admin, "X-Organization-ID": str(org.id)},
            )
        assert resp.status_code == 422, resp.text

        registro = "\n".join(r.getMessage() for r in caplog.records)
        assert "VALIDATION_ERROR" in registro, (
            f"el 422 debe quedar registrado; log capturado:\n{registro[:500]}"
        )
        assert "sku" in registro, "debe nombrar el campo que fallo"
        assert "cost" in registro, "debe nombrar todos los campos que fallaron"

    def test_no_registra_los_valores_enviados(self, client, db, org, auth_admin, caplog):
        """Un payload puede traer datos del negocio; se registran campos, no valores."""
        with caplog.at_level(logging.WARNING):
            client.post(
                "/api/products/",
                json={"name": "Secreto comercial XYZ", "price": "25.00"},
                headers={**auth_admin, "X-Organization-ID": str(org.id)},
            )
        registro = "\n".join(r.getMessage() for r in caplog.records)
        assert "Secreto comercial XYZ" not in registro, (
            "no se deben registrar los valores del payload"
        )

    def test_la_respuesta_al_cliente_no_cambia(self, client, db, org, auth_admin):
        """El frontend ya consume el formato de FastAPI: no se toca."""
        resp = client.post(
            "/api/products/",
            json={"name": "Sin costo", "price": "25.00"},
            headers={**auth_admin, "X-Organization-ID": str(org.id)},
        )
        assert resp.status_code == 422
        cuerpo = resp.json()
        assert isinstance(cuerpo.get("detail"), list), "detail sigue siendo la lista de FastAPI"
        campos = {".".join(str(x) for x in e["loc"][1:]) for e in cuerpo["detail"]}
        assert "sku" in campos and "cost" in campos
