"""Every API error has one shape: {success: false, error: {code, message, fields}}."""

import pytest
from rest_framework import exceptions
from rest_framework.test import APIClient

from accounts.factories import UserFactory
from accounts.models import Role
from core.exceptions import api_exception_handler
from employees.factories import EmployeeFactory

pytestmark = pytest.mark.django_db


def _client_for(role_name):
    user = UserFactory(role=Role.objects.get(name=role_name))
    EmployeeFactory(user=user)
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _error(response):
    body = response.json()
    assert body["success"] is False
    assert set(body["error"]) == {"code", "message", "fields"}
    return body["error"]


def test_anonymous_request_is_401_unauthenticated():
    response = APIClient().get("/api/v1/employees/")

    assert response.status_code == 401
    assert _error(response)["code"] == "UNAUTHENTICATED"


def test_missing_permission_is_403_forbidden_with_a_readable_message():
    response = _client_for("Employee").get("/api/v1/roles/")

    assert response.status_code == 403
    error = _error(response)
    assert error["code"] == "FORBIDDEN"
    assert "permission" in error["message"].lower()


def test_out_of_scope_record_is_403_forbidden():
    client = _client_for("Employee")
    stranger = EmployeeFactory()

    response = client.get(f"/api/v1/employees/{stranger.pk}/")

    assert response.status_code == 403
    assert _error(response)["code"] == "FORBIDDEN"


def test_unknown_record_is_404_not_found():
    response = _client_for("HR Admin").get("/api/v1/roles/999999/")

    assert response.status_code == 404
    assert _error(response)["code"] == "NOT_FOUND"


def test_validation_errors_list_the_offending_fields():
    response = _client_for("HR Admin").post("/api/v1/roles/", {}, format="json")

    assert response.status_code == 400
    error = _error(response)
    assert error["code"] == "VALIDATION_ERROR"
    assert "name" in error["fields"]


def test_wrong_method_is_405():
    response = _client_for("HR Admin").post("/api/v1/permissions/", {}, format="json")

    assert response.status_code == 405
    assert _error(response)["code"] == "METHOD_NOT_ALLOWED"


def test_throttle_maps_to_throttled_and_keeps_its_status():
    response = api_exception_handler(exceptions.Throttled(wait=30), {})

    assert response.status_code == 429
    assert response.data["error"]["code"] == "THROTTLED"


def test_non_api_exceptions_are_left_for_django_to_handle():
    assert api_exception_handler(RuntimeError("boom"), {}) is None
