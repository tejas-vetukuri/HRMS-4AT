"""explain_permission and the read-only access_matrix diagnostic command."""

from io import StringIO

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from accounts.factories import (
    PermissionFactory,
    RoleFactory,
    RolePermissionFactory,
    UserFactory,
    UserPermissionOverrideFactory,
)
from core.enums import ScopeTier
from core.scope import explain_permission
from employees.factories import EmployeeFactory

pytestmark = pytest.mark.django_db


def _run(*args):
    out = StringIO()
    call_command("access_matrix", *args, stdout=out)
    return out.getvalue()


def _holder(code, tier=ScopeTier.TEAM, role_active=True):
    permission = PermissionFactory(code=code)
    role = RoleFactory(is_active=role_active)
    RolePermissionFactory(role=role, permission=permission, scope_tier=tier)
    user = UserFactory(role=role, first_name="Hana", last_name="Holder")
    EmployeeFactory(user=user)
    return user


def test_explain_reports_a_role_grant():
    user = _holder("report.read")

    assert explain_permission(user, "report.read") == {
        "granted": True,
        "tier": "team",
        "source": "role",
    }


def test_explain_reports_no_grant():
    user = _holder("report.read")

    assert explain_permission(user, "other.read") == {
        "granted": False,
        "tier": None,
        "source": "none",
    }


def test_explain_reports_an_inactive_role_as_the_reason():
    user = _holder("report.read", role_active=False)

    info = explain_permission(user, "report.read")

    assert info["granted"] is False and info["source"] == "role (inactive)"


def test_explain_reports_overrides_grant_and_deny():
    user = _holder("report.read", ScopeTier.SELF)
    permission = PermissionFactory(code="report.read")
    override = UserPermissionOverrideFactory(
        user=user, permission=permission, scope_tier=ScopeTier.ALL, is_granted=True
    )

    assert explain_permission(user, "report.read") == {
        "granted": True,
        "tier": "all",
        "source": "override",
    }

    override.is_granted = False
    override.save()
    info = explain_permission(user, "report.read")
    assert info["granted"] is False and info["source"] == "override (deny)"


def test_command_lists_every_person_with_tier_and_reach():
    _holder("report.read", ScopeTier.ALL)

    output = _run("report.read")

    assert "Holder" in output and "all" in output
    assert "People by tier" in output


def test_command_names_who_one_person_can_reach():
    boss = _holder("report.read", ScopeTier.TEAM)
    report = EmployeeFactory(manager=boss.employee, user=UserFactory(first_name="Rae"))
    EmployeeFactory()  # a stranger, must not appear

    output = _run("report.read", "--user", boss.email)

    assert "Can reach 2 of" in output
    assert "Rae" in output
    assert report.employee_code not in output  # names, not codes


def test_role_grid_shows_each_roles_tier():
    _holder("report.read", ScopeTier.DEPARTMENT)

    output = _run("--roles")

    assert "report.read" in output and "department" in output


def test_command_rejects_an_unknown_permission_and_a_missing_argument():
    with pytest.raises(CommandError, match="No such permission"):
        _run("nope.nope")
    with pytest.raises(CommandError, match="Give a permission code"):
        _run()
