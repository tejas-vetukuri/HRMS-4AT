import pytest
from rest_framework.test import APIClient

from accounts.factories import RoleFactory, UserFactory
from accounts.models import Role
from employees.factories import EmployeeFactory

pytestmark = pytest.mark.django_db


def _hr():
    user = UserFactory(role=Role.objects.get(name="HR Admin"))
    EmployeeFactory(user=user)
    client = APIClient()
    client.force_authenticate(user=user)
    return client, user


def test_an_admin_cannot_change_their_own_role():
    client, me = _hr()
    other_role = RoleFactory()

    response = client.patch(f"/api/v1/users/{me.pk}/", {"role": other_role.pk}, format="json")

    assert response.status_code == 403
    assert "another administrator" in response.json()["error"]["message"]
    me.refresh_from_db()
    assert me.role.name == "HR Admin"


def test_an_admin_cannot_deactivate_themselves():
    client, me = _hr()

    response = client.patch(f"/api/v1/users/{me.pk}/", {"isActive": False}, format="json")

    assert response.status_code == 403
    me.refresh_from_db()
    assert me.is_active is True


def test_an_admin_can_still_manage_someone_else():
    client, _ = _hr()
    colleague = UserFactory(role=RoleFactory())

    changed_role = client.patch(
        f"/api/v1/users/{colleague.pk}/",
        {"role": Role.objects.get(name="Manager").pk},
        format="json",
    )
    deactivated = client.patch(f"/api/v1/users/{colleague.pk}/", {"isActive": False}, format="json")

    assert changed_role.status_code == 200 and deactivated.status_code == 200


def test_an_admin_patching_themselves_with_no_real_change_is_allowed():
    client, me = _hr()

    response = client.patch(f"/api/v1/users/{me.pk}/", {"role": me.role.pk}, format="json")

    assert response.status_code == 200
