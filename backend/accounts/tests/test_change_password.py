import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.factories import UserFactory
from audit.models import AuditLog

pytestmark = pytest.mark.django_db

URL = "/api/v1/users/me/change-password"
OLD = "Old-Passw0rd-xyz"
NEW = "Brand-New-Passw0rd-42"


def _user():
    user = UserFactory()
    user.set_password(OLD)
    user.save()
    return user


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def test_changing_the_password_switches_it_and_returns_a_fresh_token_pair():
    user = _user()

    response = _client(user).post(URL, {"currentPassword": OLD, "newPassword": NEW}, format="json")

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["accessToken"] and data["refreshToken"]
    user.refresh_from_db()
    assert user.check_password(NEW) and not user.check_password(OLD)


def test_every_earlier_session_is_revoked():
    user = _user()
    earlier = RefreshToken.for_user(user)

    _client(user).post(URL, {"currentPassword": OLD, "newPassword": NEW}, format="json")

    assert BlacklistedToken.objects.filter(token__jti=earlier["jti"]).exists()


def test_the_change_is_audited_without_recording_either_password():
    user = _user()

    _client(user).post(URL, {"currentPassword": OLD, "newPassword": NEW}, format="json")

    entry = AuditLog.objects.get(action="user.password_changed")
    assert entry.actor_id == user.pk
    assert OLD not in str(entry.diff) and NEW not in str(entry.diff)


def test_a_wrong_current_password_is_refused_and_nothing_changes():
    user = _user()

    response = _client(user).post(
        URL, {"currentPassword": "nope", "newPassword": NEW}, format="json"
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_CREDENTIALS"
    user.refresh_from_db()
    assert user.check_password(OLD)


def test_a_weak_new_password_is_refused_with_the_reasons():
    user = _user()

    response = _client(user).post(
        URL, {"currentPassword": OLD, "newPassword": "12345678"}, format="json"
    )

    assert response.status_code == 400
    assert response.json()["error"]["fields"]["newPassword"]


def test_the_new_password_must_differ_from_the_current_one():
    user = _user()

    response = _client(user).post(URL, {"currentPassword": OLD, "newPassword": OLD}, format="json")

    assert response.status_code == 400


def test_anonymous_callers_are_refused():
    response = APIClient().post(URL, {"currentPassword": OLD, "newPassword": NEW}, format="json")

    assert response.status_code == 401
