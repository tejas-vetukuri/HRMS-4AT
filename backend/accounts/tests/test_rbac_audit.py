"""Every RBAC mutation must land in the audit log (docs/REQUIREMENTS.md's
"audit everything") — this proves AuditedModelViewSet (audit/mixins.py)
actually wires create/update/delete for Role, RolePermission, and
UserPermissionOverride, not just that the endpoints work."""

import pytest
from rest_framework.test import APIClient

from accounts.factories import PermissionFactory, RoleFactory, RolePermissionFactory, UserFactory
from audit.models import AuditLog
from core.enums import ScopeTier
from employees.factories import EmployeeFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def admin_client():
    manage_permission = PermissionFactory(code="roles.manage")
    admin_role = RoleFactory(name="Audit Test Admin")
    RolePermissionFactory(role=admin_role, permission=manage_permission, scope_tier=ScopeTier.ALL)
    admin_user = UserFactory(role=admin_role)
    EmployeeFactory(user=admin_user)

    client = APIClient()
    client.force_authenticate(user=admin_user)
    return client, admin_user


def test_role_create_is_audited(admin_client):
    client, admin_user = admin_client

    resp = client.post(
        "/api/v1/roles/",
        {"name": "New Custom Role", "archetype": "employee", "isActive": True},
        format="json",
    )

    assert resp.status_code == 201
    role_id = resp.json()["id"]
    log = AuditLog.objects.get(action="Role.created", entity_id=str(role_id))
    assert log.actor == admin_user
    assert log.diff["after"]["name"] == "New Custom Role"


def test_role_update_is_audited(admin_client):
    client, _ = admin_client
    role = RoleFactory(name="Before Name", is_active=True)

    client.patch(f"/api/v1/roles/{role.pk}/", {"isActive": False}, format="json")

    log = AuditLog.objects.get(action="Role.updated", entity_id=str(role.pk))
    assert log.diff["before"]["isActive"] is True
    assert log.diff["after"]["isActive"] is False


def test_role_delete_is_audited(admin_client):
    client, _ = admin_client
    role = RoleFactory(name="To Delete")

    resp = client.delete(f"/api/v1/roles/{role.pk}/")

    assert resp.status_code == 204
    log = AuditLog.objects.get(action="Role.deleted", entity_id=str(role.pk))
    assert log.diff["before"]["name"] == "To Delete"


def test_role_permission_grant_is_audited(admin_client):
    client, admin_user = admin_client
    role = RoleFactory()
    permission = PermissionFactory(code="test.audited.permission")

    resp = client.post(
        "/api/v1/role-permissions/",
        {"role": role.pk, "permission": permission.pk, "scopeTier": "department"},
        format="json",
    )

    assert resp.status_code == 201
    log = AuditLog.objects.get(action="RolePermission.created")
    assert log.actor == admin_user
    assert log.diff["after"]["scopeTier"] == "department"


def test_user_permission_override_create_is_audited(admin_client):
    client, admin_user = admin_client
    target_user = UserFactory()
    EmployeeFactory(user=target_user)
    permission = PermissionFactory(code="test.override.permission")

    resp = client.post(
        "/api/v1/user-permission-overrides/",
        {
            "user": target_user.pk,
            "permission": permission.pk,
            "scopeTier": "all",
            "isGranted": True,
        },
        format="json",
    )

    assert resp.status_code == 201
    log = AuditLog.objects.get(action="UserPermissionOverride.created")
    assert log.actor == admin_user
    assert log.diff["after"]["isGranted"] is True
