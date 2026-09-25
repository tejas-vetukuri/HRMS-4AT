"""Session management — the one RBAC-engine subtask outside the original
9-step sequence: list/revoke a user's own sessions, and admin force-logout.
Built on simplejwt's OutstandingToken/BlacklistedToken, not a new model."""

import pytest
from rest_framework.test import APIClient

from accounts.factories import PermissionFactory, RoleFactory, RolePermissionFactory, UserFactory
from audit.models import AuditLog
from core.enums import ScopeTier
from employees.factories import EmployeeFactory

pytestmark = pytest.mark.django_db

PASSWORD = "correct horse battery staple"


def _user_with_password(**kwargs):
    user = UserFactory(**kwargs)
    user.set_password(PASSWORD)
    user.save(update_fields=["password"])
    return user


def _login(client, email):
    resp = client.post("/api/v1/auth/login", {"email": email, "password": PASSWORD})
    assert resp.status_code == 200
    return resp.json()["data"]


def test_my_sessions_requires_auth():
    client = APIClient()
    resp = client.get("/api/v1/users/me/sessions")
    assert resp.status_code == 401


def test_login_creates_a_listed_session():
    user = _user_with_password(email="s1@example.com")
    EmployeeFactory(user=user)
    client = APIClient()
    data = _login(client, "s1@example.com")

    resp = client.get(
        "/api/v1/users/me/sessions", HTTP_AUTHORIZATION=f"Bearer {data['accessToken']}"
    )

    assert resp.status_code == 200
    sessions = resp.json()["data"]
    assert len(sessions) == 1
    assert sessions[0]["isRevoked"] is False


def test_two_logins_produce_two_sessions():
    user = _user_with_password(email="s2@example.com")
    EmployeeFactory(user=user)
    client = APIClient()
    _login(client, "s2@example.com")
    data2 = _login(client, "s2@example.com")

    resp = client.get(
        "/api/v1/users/me/sessions", HTTP_AUTHORIZATION=f"Bearer {data2['accessToken']}"
    )

    assert len(resp.json()["data"]) == 2


def test_user_can_revoke_their_own_session():
    user = _user_with_password(email="s3@example.com")
    EmployeeFactory(user=user)
    client = APIClient()
    data = _login(client, "s3@example.com")
    auth = {"HTTP_AUTHORIZATION": f"Bearer {data['accessToken']}"}

    session_id = client.get("/api/v1/users/me/sessions", **auth).json()["data"][0]["id"]

    resp = client.delete(f"/api/v1/users/me/sessions/{session_id}", **auth)
    assert resp.status_code == 204

    remaining = client.get("/api/v1/users/me/sessions", **auth).json()["data"]
    assert remaining == []


def test_revoking_own_session_is_audited():
    user = _user_with_password(email="s4@example.com")
    EmployeeFactory(user=user)
    client = APIClient()
    data = _login(client, "s4@example.com")
    auth = {"HTTP_AUTHORIZATION": f"Bearer {data['accessToken']}"}
    session_id = client.get("/api/v1/users/me/sessions", **auth).json()["data"][0]["id"]

    client.delete(f"/api/v1/users/me/sessions/{session_id}", **auth)

    log = AuditLog.objects.get(action="auth.session_revoked")
    assert log.actor == user


def test_user_cannot_revoke_someone_elses_session():
    victim = _user_with_password(email="victim@example.com")
    EmployeeFactory(user=victim)
    attacker = _user_with_password(email="attacker@example.com")
    EmployeeFactory(user=attacker)
    client = APIClient()

    victim_data = _login(client, "victim@example.com")
    victim_session_id = client.get(
        "/api/v1/users/me/sessions", HTTP_AUTHORIZATION=f"Bearer {victim_data['accessToken']}"
    ).json()["data"][0]["id"]

    attacker_data = _login(client, "attacker@example.com")
    resp = client.delete(
        f"/api/v1/users/me/sessions/{victim_session_id}",
        HTTP_AUTHORIZATION=f"Bearer {attacker_data['accessToken']}",
    )

    assert resp.status_code == 404


def test_revoked_session_refresh_token_no_longer_works():
    user = _user_with_password(email="s5@example.com")
    EmployeeFactory(user=user)
    client = APIClient()
    data = _login(client, "s5@example.com")
    auth = {"HTTP_AUTHORIZATION": f"Bearer {data['accessToken']}"}
    session_id = client.get("/api/v1/users/me/sessions", **auth).json()["data"][0]["id"]

    client.delete(f"/api/v1/users/me/sessions/{session_id}", **auth)

    resp = client.post("/api/v1/auth/refresh", {"refreshToken": data["refreshToken"]})
    assert resp.status_code == 401


def test_admin_can_force_logout_a_user():
    manage_permission = PermissionFactory(code="roles.manage")
    admin_role = RoleFactory(name="Session Test Admin")
    RolePermissionFactory(role=admin_role, permission=manage_permission, scope_tier=ScopeTier.ALL)
    admin_user = UserFactory(role=admin_role)
    EmployeeFactory(user=admin_user)

    target = _user_with_password(email="target@example.com")
    EmployeeFactory(user=target)

    client = APIClient()
    target_data = _login(client, "target@example.com")

    admin_client = APIClient()
    admin_client.force_authenticate(user=admin_user)
    resp = admin_client.post(f"/api/v1/users/{target.pk}/revoke-sessions/")

    assert resp.status_code == 200
    assert resp.json()["data"]["revokedCount"] == 1

    refresh_resp = client.post(
        "/api/v1/auth/refresh", {"refreshToken": target_data["refreshToken"]}
    )
    assert refresh_resp.status_code == 401

    log = AuditLog.objects.get(action="User.sessions_revoked")
    assert log.actor == admin_user
    assert log.diff["revokedCount"] == 1


def test_non_admin_cannot_force_logout_others():
    user = UserFactory(role=None)
    EmployeeFactory(user=user)
    target = UserFactory()
    EmployeeFactory(user=target)
    client = APIClient()
    client.force_authenticate(user=user)

    resp = client.post(f"/api/v1/users/{target.pk}/revoke-sessions/")

    assert resp.status_code == 403
