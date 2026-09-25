import pytest
from rest_framework.test import APIClient

from accounts.factories import UserFactory
from accounts.models import Role
from audit.models import AuditLog
from audit.service import write_audit
from employees.factories import EmployeeFactory

pytestmark = pytest.mark.django_db

URL = "/api/v1/audit-log/"


def _client(role_name):
    user = UserFactory(role=Role.objects.get(name=role_name), first_name="Ada", last_name="Admin")
    EmployeeFactory(user=user)
    client = APIClient()
    client.force_authenticate(user=user)
    return client, user


def _rows(response):
    return response.json()["results"]


def test_hr_admin_reads_the_log_newest_first_with_who_did_it():
    client, hr = _client("HR Admin")
    write_audit(hr, "Role.created", "Role", 1, {"after": {"name": "X"}})
    write_audit(hr, "User.role_changed", "User", 2)

    response = client.get(URL)

    assert response.status_code == 200
    rows = _rows(response)
    assert [r["action"] for r in rows][:2] == ["User.role_changed", "Role.created"]
    assert rows[0]["actorName"] == "Ada Admin"
    assert rows[0]["actorEmail"] == hr.email
    assert response.json()["total"] >= 2


def test_people_without_audit_read_are_refused():
    for role in ("Employee", "Manager", "Finance"):
        client, _ = _client(role)

        assert client.get(URL).status_code == 403


def test_anonymous_is_401():
    assert APIClient().get(URL).status_code == 401


def test_log_entries_cannot_be_written_or_removed_through_the_api():
    client, hr = _client("HR Admin")
    entry = write_audit(hr, "Role.created", "Role", 1)

    assert client.post(URL, {}, format="json").status_code == 405
    assert client.delete(f"{URL}{entry.pk}/").status_code == 405
    assert client.patch(f"{URL}{entry.pk}/", {"action": "x"}, format="json").status_code == 405
    assert AuditLog.objects.filter(pk=entry.pk, action="Role.created").exists()


def test_filters_by_action_record_and_search():
    client, hr = _client("HR Admin")
    other = UserFactory(email="zed@example.com", first_name="Zed", last_name="Zimmer")
    write_audit(hr, "Role.created", "Role", 7)
    write_audit(hr, "Role.updated", "Role", 7)
    write_audit(other, "Employee.updated", "Employee", 9)

    by_action = _rows(client.get(URL, {"action": "Role.created"}))
    by_record = _rows(client.get(URL, {"entity_type": "Role", "entity_id": "7"}))
    by_actor = _rows(client.get(URL, {"search": "zimmer"}))

    assert [r["action"] for r in by_action] == ["Role.created"]
    assert {r["action"] for r in by_record} == {"Role.created", "Role.updated"}
    assert [r["action"] for r in by_actor] == ["Employee.updated"]


def test_unauthenticated_events_show_no_actor():
    client, _ = _client("HR Admin")
    write_audit(None, "auth.login_failed", "User", None, {"email": "x@y.z"})

    row = _rows(client.get(URL, {"action": "auth.login_failed"}))[0]

    assert row["actor"] is None and row["actorName"] is None


def test_paginates_with_a_page_size():
    client, hr = _client("HR Admin")
    for n in range(5):
        write_audit(hr, "Role.created", "Role", n)

    response = client.get(URL, {"action": "Role.created", "pageSize": 2})

    body = response.json()
    assert len(body["results"]) == 2 and body["total"] == 5 and body["pageSize"] == 2
