import pytest

from accounts.factories import UserFactory
from audit.models import AuditLog
from audit.service import write_audit

pytestmark = pytest.mark.django_db


def test_write_audit_creates_row_with_actor():
    user = UserFactory()

    log = write_audit(user, "test.action", "TestEntity", 42, {"foo": "bar"})

    assert AuditLog.objects.count() == 1
    assert log.actor == user
    assert log.action == "test.action"
    assert log.entity_type == "TestEntity"
    assert log.entity_id == "42"
    assert log.diff == {"foo": "bar"}


def test_write_audit_with_no_actor_records_null():
    log = write_audit(None, "auth.login_failed", "User", None, {"email": "x@example.com"})

    assert log.actor is None
    assert log.entity_id == ""
    assert log.diff == {"email": "x@example.com"}


def test_write_audit_defaults_diff_to_empty_dict():
    log = write_audit(None, "test.action", "TestEntity", 1)

    assert log.diff == {}
