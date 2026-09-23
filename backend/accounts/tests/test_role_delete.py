import pytest
from rest_framework.test import APIClient

from accounts.factories import RoleFactory, UserFactory
from accounts.models import Role
from audit.models import AuditLog
from employees.factories import EmployeeFactory

pytestmark = pytest.mark.django_db


def _hr():
    user = UserFactory(role=Role.objects.get(name="HR Admin"))
    EmployeeFactory(user=user)
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def test_deleting_a_role_that_people_still_hold_is_a_clear_409_not_a_crash():
    role = RoleFactory(name="Test Held Role")
    UserFactory(role=role)
    UserFactory(role=role)

    response = _hr().delete(f"/api/v1/roles/{role.pk}/")

    assert response.status_code == 409
    error = response.json()["error"]
    assert error["code"] == "CONFLICT"
    assert "2 people" in error["message"] and "deactivate" in error["message"]
    assert Role.objects.filter(pk=role.pk).exists()


def test_an_unused_role_can_still_be_deleted_and_it_is_audited():
    role = RoleFactory(name="Test Unused Role")

    response = _hr().delete(f"/api/v1/roles/{role.pk}/")

    assert response.status_code == 204
    assert not Role.objects.filter(pk=role.pk).exists()
    assert AuditLog.objects.filter(action="Role.deleted", entity_id=str(role.pk)).exists()
