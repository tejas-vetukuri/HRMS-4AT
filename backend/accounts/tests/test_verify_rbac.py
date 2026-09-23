"""The live verification command must (a) pass on a healthy engine, (b) leave
no data behind, and (c) actually fail when the engine is broken. (c) is the
point: a verification that cannot fail proves nothing."""

from io import StringIO

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from accounts.models import Role, User
from employees.models import Department, Employee, LegalEntity, Location

pytestmark = pytest.mark.django_db


def _run():
    out = StringIO()
    call_command("verify_rbac", stdout=out)
    return out.getvalue()


def test_passes_on_a_healthy_engine_and_prints_each_check():
    output = _run()

    assert "checks passed" in output
    assert "FAIL" not in output
    assert "POST   /api/v1/auth/login" in output  # requests are shown, not just results


def test_leaves_nothing_behind():
    roles_before = set(Role.objects.values_list("name", flat=True))

    _run()

    assert not User.objects.filter(email__endswith="@verify.invalid").exists()
    assert not Employee.objects.filter(employee_code__startswith="VFY-").exists()
    assert not Department.objects.filter(name__startswith="VFY").exists()
    assert not Location.objects.filter(name__startswith="VFY").exists()
    assert not LegalEntity.objects.filter(name__startswith="VFY").exists()
    assert set(Role.objects.values_list("name", flat=True)) == roles_before


def test_fails_when_scope_filtering_is_broken(monkeypatch):
    """Simulate the IDOR regression: the directory ignores scope and returns everyone."""
    monkeypatch.setattr(
        "employees.views.resolve_employee_scope", lambda user, code: Employee.objects.all()
    )

    with pytest.raises(CommandError, match="failed"):
        _run()


def test_fails_when_permission_checks_are_broken(monkeypatch):
    """Simulate every permission check passing: admin endpoints open to everyone."""
    monkeypatch.setattr("core.permissions.user_has_permission", lambda user, code: True)

    with pytest.raises(CommandError, match="failed"):
        _run()


def test_refuses_to_run_under_production_settings(settings):
    settings.SETTINGS_MODULE = "config.settings.prod"

    with pytest.raises(CommandError, match="production"):
        _run()
