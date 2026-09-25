"""The reference module passes the conformance kit, and the kit fails when the
module is wrong. The second half matters more: a conformance check that cannot
fail would tell a module author nothing."""

import pytest

from core.testing import assert_module_conforms
from employees.models import Employee
from example_leave import views
from example_leave.conformance import ENDPOINT

pytestmark = pytest.mark.django_db


def test_reference_module_conforms():
    verifier = assert_module_conforms(ENDPOINT)

    assert verifier.passed >= 30


def test_kit_catches_a_list_that_ignores_scope(monkeypatch):
    """The original IDOR: the view returns every record instead of the caller's scope."""
    monkeypatch.setattr(views, "resolve_employee_scope", lambda user, code: Employee.objects.all())

    with pytest.raises(AssertionError, match="list under 'self'"):
        assert_module_conforms(ENDPOINT)


def test_kit_catches_an_action_authorised_by_the_read_permission(monkeypatch):
    monkeypatch.setattr(
        views.LeaveRequestViewSet, "action_permissions", {"approve": "example_leave.read"}
    )

    with pytest.raises(AssertionError, match="'approve' is refused to someone who can only read"):
        assert_module_conforms(ENDPOINT)


def test_kit_catches_create_authorised_by_the_read_permission(monkeypatch):
    monkeypatch.setattr(views.LeaveRequestViewSet, "write_permission", "example_leave.read")

    with pytest.raises(AssertionError, match="read permission alone cannot create"):
        assert_module_conforms(ENDPOINT)


def test_kit_catches_an_owner_taken_from_the_request_body(monkeypatch):
    def owner_from_body(self, serializer):
        serializer.save(employee=Employee.objects.get(pk=self.request.data["employee"]))

    monkeypatch.setattr(views.LeaveRequestViewSet, "perform_create", owner_from_body)

    with pytest.raises(AssertionError, match="the owner is the caller"):
        assert_module_conforms(ENDPOINT)


def test_kit_catches_a_missing_audit_entry(monkeypatch):
    monkeypatch.setattr(views, "write_audit", lambda *args, **kwargs: None)

    with pytest.raises(AssertionError, match="wrote the audit entry"):
        assert_module_conforms(ENDPOINT)
