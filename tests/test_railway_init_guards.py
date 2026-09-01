"""Tests: guardas de entorno del arranque (scripts/railway_init.py).

El contenedor corre `railway_init.py` en cada arranque. En una base de
produccion con un cliente real no deben sembrarse organizaciones demo con
usuarios de contrasena conocida, y la contrasena del superadministrador no
debe estar escrita en el codigo.
"""
import importlib

import pytest

ri = importlib.import_module("scripts.railway_init")


class TestSeedDemoGuard:
    def test_por_omision_siembra(self, monkeypatch):
        """Sin variable, se conserva el comportamiento actual de Railway."""
        monkeypatch.delenv("ATLAS_SEED_DEMO", raising=False)
        assert ri.should_seed_demo() is True

    @pytest.mark.parametrize("valor", ["0", "false", "False", "no", "off", "NO"])
    def test_se_puede_apagar(self, monkeypatch, valor):
        monkeypatch.setenv("ATLAS_SEED_DEMO", valor)
        assert ri.should_seed_demo() is False

    @pytest.mark.parametrize("valor", ["1", "true", "yes", "on"])
    def test_se_puede_prender_explicitamente(self, monkeypatch, valor):
        monkeypatch.setenv("ATLAS_SEED_DEMO", valor)
        assert ri.should_seed_demo() is True


class TestSuperadminPassword:
    def test_toma_la_del_entorno(self, monkeypatch):
        monkeypatch.setenv("SUPERADMIN_PASSWORD", "una-contrasena-larga-y-propia")
        assert ri.superadmin_password() == "una-contrasena-larga-y-propia"

    def test_sin_variable_no_devuelve_la_del_repositorio(self, monkeypatch):
        """El valor historico 784512 esta publicado en el repositorio."""
        monkeypatch.delenv("SUPERADMIN_PASSWORD", raising=False)
        assert ri.superadmin_password() != "784512"

    def test_sin_variable_genera_algo_no_adivinable(self, monkeypatch):
        monkeypatch.delenv("SUPERADMIN_PASSWORD", raising=False)
        a = ri.superadmin_password()
        b = ri.superadmin_password()
        assert len(a) >= 20
        assert a != b, "cada arranque sin variable debe generar una distinta"
