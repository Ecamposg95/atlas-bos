"""
Tests: Product visibility by role and branch.
Verifies that CAJERO/GERENTE only see products enabled in their branch,
while ADMINISTRADOR sees all products.
"""
import pytest


class TestProductBranchVisibility:
    """POS search endpoint: /api/products/pos/search"""

    def test_cajero_only_sees_own_branch_products(
        self, client, auth_cajero_a, products_setup
    ):
        """CAJERO at Branch A should see Product A and Product Both, NOT Product B."""
        resp = client.get("/api/products/pos/search?q=Producto", headers=auth_cajero_a)
        assert resp.status_code == 200
        names = [p["name"] for p in resp.json()]
        assert "Producto A" in names, "CAJERO should see product enabled in their branch"
        assert "Producto Ambos" in names, "CAJERO should see product enabled in both branches"
        assert "Producto B" not in names, "CAJERO must NOT see product from another branch"

    def test_cajero_cannot_see_other_branch_products(
        self, client, auth_cajero_a, products_setup
    ):
        """Searching by SKU of Branch B product should return nothing for CAJERO at A."""
        resp = client.get("/api/products/pos/search?q=SKU-B", headers=auth_cajero_a)
        assert resp.status_code == 200
        results = resp.json()
        skus = [p.get("sku") for p in results]
        assert "SKU-B" not in skus, "CAJERO must NOT find products from another branch by SKU"

    def test_gerente_only_sees_own_branch_products(
        self, client, auth_gerente_a, products_setup
    ):
        """GERENTE at Branch A should have same visibility as CAJERO."""
        resp = client.get("/api/products/pos/search?q=Producto", headers=auth_gerente_a)
        assert resp.status_code == 200
        names = [p["name"] for p in resp.json()]
        assert "Producto A" in names
        assert "Producto Ambos" in names
        assert "Producto B" not in names

    def test_admin_sees_all_products(
        self, client, auth_admin, products_setup
    ):
        """ADMINISTRADOR should see ALL products regardless of branch assignment."""
        resp = client.get("/api/products/pos/search?q=Producto", headers=auth_admin)
        assert resp.status_code == 200
        names = [p["name"] for p in resp.json()]
        assert "Producto A" in names
        assert "Producto B" in names
        assert "Producto Ambos" in names
