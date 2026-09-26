"""Employee lifecycle fields, personal details, and the self-service profile."""

from datetime import date, timedelta

import pytest
from rest_framework.test import APIClient

from accounts.factories import (
    PermissionFactory,
    RoleFactory,
    RolePermissionFactory,
    UserFactory,
    UserPermissionOverrideFactory,
)
from accounts.models import Role
from audit.models import AuditLog
from core.enums import ScopeTier
from employees.factories import DepartmentFactory, EmployeeFactory
from employees.models import BusinessUnit, CostCenter

pytestmark = pytest.mark.django_db

URL = "/api/v1/employees/"


def _client_for(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _as(role_name):
    user = UserFactory(role=Role.objects.get(name=role_name))
    employee = EmployeeFactory(user=user)
    return _client_for(user), employee


def _body(**overrides):
    return {
        "first_name": "Nia",
        "last_name": "North",
        "work_email": "nia.north@example.com",
        "employee_code": "T-0001",
        **overrides,
    }


# --- lifecycle ------------------------------------------------------------------------------


def test_hr_creates_an_employee_with_the_org_and_lifecycle_fields():
    hr, _ = _as("HR Admin")
    bu, cc = BusinessUnit.objects.create(name="BU"), CostCenter.objects.create(name="CC")

    response = hr.post(
        URL,
        _body(
            business_unit_id=bu.pk,
            cost_center_id=cc.pk,
            employment_type="contract",
            date_of_joining="2024-03-04",
        ),
        format="json",
    )

    assert response.status_code == 201
    data = response.json()["data"]
    assert data["business_unit_id"] == str(bu.pk) and data["cost_center_id"] == str(cc.pk)
    assert data["employment_type"] == "contract" and data["date_of_joining"] == "2024-03-04"
    assert data["date_of_exit"] is None


def test_an_exit_date_before_the_joining_date_is_rejected():
    hr, _ = _as("HR Admin")
    person = EmployeeFactory(date_of_joining=date(2024, 5, 1))

    response = hr.patch(
        f"{URL}{person.pk}/", {"status": "exited", "date_of_exit": "2024-01-01"}, format="json"
    )

    assert response.status_code == 400
    assert "date_of_exit" in response.json()["error"]["fields"]


def test_an_exit_date_only_makes_sense_for_someone_who_has_left():
    hr, _ = _as("HR Admin")
    person = EmployeeFactory()

    response = hr.patch(f"{URL}{person.pk}/", {"date_of_exit": "2025-01-01"}, format="json")

    assert response.status_code == 400


def test_leaving_records_today_when_no_exit_date_is_given():
    hr, _ = _as("HR Admin")
    person = EmployeeFactory()

    hr.patch(f"{URL}{person.pk}/", {"status": "exited", "exit_reason": "Resigned"}, format="json")

    person.refresh_from_db()
    assert person.date_of_exit == date.today() and person.exit_reason == "Resigned"


def test_an_explicit_exit_date_is_kept():
    hr, _ = _as("HR Admin")
    person = EmployeeFactory()
    last_day = date.today() - timedelta(days=10)

    hr.patch(
        f"{URL}{person.pk}/",
        {"status": "exited", "date_of_exit": last_day.isoformat()},
        format="json",
    )

    person.refresh_from_db()
    assert person.date_of_exit == last_day


def test_returning_clears_the_exit_details():
    hr, _ = _as("HR Admin")
    person = EmployeeFactory(status="exited", date_of_exit=date(2024, 1, 1), exit_reason="Moved")
    person.user.is_active = False
    person.user.save()

    hr.patch(f"{URL}{person.pk}/", {"status": "active"}, format="json")

    person.refresh_from_db()
    assert person.date_of_exit is None and person.exit_reason == ""
    assert person.user.is_active is True


def test_the_directory_can_be_filtered_by_department_status_and_missing_manager():
    hr, _ = _as("HR Admin")
    dept = DepartmentFactory()
    boss = EmployeeFactory(department=dept)
    report = EmployeeFactory(department=dept, manager=boss)
    gone = EmployeeFactory(status="exited")

    def ids(**params):
        return {r["id"] for r in hr.get(URL, params).json()["data"]}

    assert ids(department=dept.pk) == {str(boss.pk), str(report.pk)}
    assert str(gone.pk) in ids(status="exited") and str(report.pk) not in ids(status="exited")
    assert str(boss.pk) in ids(no_manager="1") and str(report.pk) not in ids(no_manager="1")


# --- personal details --------------------------------------------------------------------------


def test_the_ordinary_directory_never_carries_personal_details():
    hr, _ = _as("HR Admin")
    person = EmployeeFactory(phone="555-0100", dob=date(1990, 1, 1), personal_email="p@example.com")

    listed = next(r for r in hr.get(URL).json()["data"] if r["id"] == str(person.pk))
    opened = hr.get(f"{URL}{person.pk}/").json()["data"]

    for row in (listed, opened):
        assert not {"phone", "dob", "personal_email", "gender", "exit_reason"} & set(row)


def test_hr_reads_and_changes_personal_details():
    hr, _ = _as("HR Admin")
    person = EmployeeFactory()

    changed = hr.patch(
        f"{URL}{person.pk}/personal/",
        {
            "phone": "555-0199",
            "dob": "1988-07-09",
            "gender": "female",
            "personal_email": "z@example.com",
        },
        format="json",
    )
    read = hr.get(f"{URL}{person.pk}/personal/")

    assert changed.status_code == 200 and read.status_code == 200
    assert read.json()["data"]["phone"] == "555-0199" and read.json()["data"]["dob"] == "1988-07-09"


def test_the_audit_entry_names_the_fields_changed_but_never_their_values():
    hr, _ = _as("HR Admin")
    person = EmployeeFactory()

    hr.patch(
        f"{URL}{person.pk}/personal/", {"phone": "555-0177", "dob": "1990-02-02"}, format="json"
    )

    entry = AuditLog.objects.get(action="Employee.personal_updated")
    assert entry.diff == {"fields": ["dob", "phone"]}
    assert "555-0177" not in str(entry.diff) and "1990" not in str(entry.diff)


@pytest.mark.parametrize("role", ["Employee", "Manager", "Finance"])
def test_people_without_the_personal_permission_cannot_read_anyone_elses(role):
    client, _ = _as(role)
    person = EmployeeFactory()

    assert client.get(f"{URL}{person.pk}/personal/").status_code == 403


def test_reading_personal_details_is_not_enough_to_change_them():
    role = RoleFactory()
    for code in ("employees.read", "employees.personal.read"):
        RolePermissionFactory(
            role=role, permission=PermissionFactory(code=code), scope_tier=ScopeTier.ALL
        )
    user = UserFactory(role=role)
    EmployeeFactory(user=user)
    person = EmployeeFactory()
    client = _client_for(user)

    assert client.get(f"{URL}{person.pk}/personal/").status_code == 200
    assert (
        client.patch(f"{URL}{person.pk}/personal/", {"phone": "1"}, format="json").status_code
        == 403
    )


def test_personal_details_are_validated():
    hr, _ = _as("HR Admin")
    person = EmployeeFactory()
    tomorrow = (date.today() + timedelta(days=1)).isoformat()

    future = hr.patch(f"{URL}{person.pk}/personal/", {"dob": tomorrow}, format="json")
    odd = hr.patch(f"{URL}{person.pk}/personal/", {"gender": "banana"}, format="json")

    assert future.status_code == 400 and odd.status_code == 400


# --- self-service profile ----------------------------------------------------------------------


ESS = "/api/v1/ess/profile"


@pytest.mark.parametrize("role", ["Employee", "Manager", "HR Admin", "Finance"])
def test_everyone_sees_their_own_profile_in_the_frontends_shape(role):
    client, me = _as(role)

    response = client.get(ESS)

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["id"] == str(me.pk) and data["employee_code"] == me.employee_code
    assert {
        "first_name",
        "work_email",
        "personal_email",
        "phone",
        "dob",
        "gender",
        "department_id",
        "designation_id",
        "location_id",
        "date_of_joining",
        "status",
        "manager_id",
    } <= set(data)


def test_the_profile_is_always_the_callers_and_takes_no_id():
    client, me = _as("Employee")
    EmployeeFactory()

    assert client.get(ESS).json()["data"]["id"] == str(me.pk)
    assert client.get(ESS + "/").status_code == 200  # trailing slash tolerated too


def test_a_person_updates_their_own_contact_details_with_put_as_the_frontend_does():
    client, me = _as("Employee")

    response = client.put(ESS, {"dob": "1992-03-04", "gender": "male"}, format="json")

    assert response.status_code == 200
    me.refresh_from_db()
    assert me.dob == date(1992, 3, 4) and me.gender == "male"
    assert AuditLog.objects.filter(action="Employee.profile_self_updated").exists()


def test_self_service_cannot_change_job_manager_or_status():
    client, me = _as("Employee")
    boss = EmployeeFactory()

    client.patch(
        ESS,
        {"manager_id": boss.pk, "status": "exited", "employee_code": "HACK", "phone": "555"},
        format="json",
    )

    me.refresh_from_db()
    assert me.manager_id is None and me.status == "active" and me.employee_code != "HACK"
    assert me.phone == "555"


def test_self_service_can_be_switched_off_for_one_person():
    client, me = _as("Employee")
    UserPermissionOverrideFactory(
        user=me.user,
        permission=PermissionFactory(code="ess.profile.write"),
        scope_tier=ScopeTier.SELF,
        is_granted=False,
    )

    assert client.get(ESS).status_code == 200
    assert client.patch(ESS, {"phone": "1"}, format="json").status_code == 403


def test_an_account_with_no_employee_record_gets_a_clear_404():
    user = UserFactory(role=Role.objects.get(name="Employee"))

    response = _client_for(user).get(ESS)

    assert response.status_code == 404


def test_anonymous_callers_are_refused():
    assert APIClient().get(ESS).status_code == 401
