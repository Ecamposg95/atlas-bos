"""
Tests: Platform/Superadmin security hardening.
Verifies that mass assignment is blocked, cascade protection works,
and privilege escalation is prevented.
"""
import pytest


class TestPlatformSecurity:
    """Test platform endpoint security controls."""

    def test_user_create_blocks_platform_role_escalation(
        self, client, auth_superadmin, db, org, branch_a
    ):
        """Creating a user with platform_role=SUPERADMIN should be ignored."""
        resp = client.post(
            "/api/platform/users",
            json={
                "username": "evil_user",
                "password": "password123",
                "role": "CAJERO",
                "platform_role": "SUPERADMIN",
                "branch_id": branch_a.id,
                "organization_id": org.id,
            },
            headers=auth_superadmin,
        )
        assert resp.status_code == 200, f"User creation should succeed, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data["platform_role"] != "SUPERADMIN", \
            "platform_role should be forced to NONE, not SUPERADMIN"

    def test_org_delete_blocked_with_branches(
        self, client, auth_superadmin, db, org, branch_a
    ):
        """Cannot delete an organization that has branches."""
        resp = client.delete(
            f"/api/platform/organizations/{org.id}",
            headers=auth_superadmin,
        )
        assert resp.status_code == 400, f"Should block delete, got {resp.status_code}"
        assert "sucursal" in resp.json().get("detail", "").lower()

    def test_branch_delete_detaches_users_not_cascade_deletes(
        self, client, auth_superadmin, db, org, branch_a, cajero_a
    ):
        """Deleting a branch with users must DETACH them (branch_id=None),
        never cascade-delete the user rows. Blocking is reserved for
        destructive data (sales/cash sessions), which is covered separately.
        """
        from app.models.users import User

        user_id = cajero_a.id
        resp = client.delete(
            f"/api/platform/branches/{branch_a.id}",
            headers=auth_superadmin,
        )
        assert resp.status_code == 200, f"Delete should succeed, got {resp.status_code}: {resp.text}"
        assert resp.json().get("detached_users", 0) >= 1

        # The user must still exist, just detached from the deleted branch.
        db.expire_all()
        survivor = db.query(User).filter(User.id == user_id).first()
        assert survivor is not None, "User must NOT be cascade-deleted with the branch"
        assert survivor.branch_id is None
