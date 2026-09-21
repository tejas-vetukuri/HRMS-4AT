"""Mounted at /api/v1/ (docs/IMPLEMENTATION-PLAN.md's contract). Auth endpoints
(Phase 1's /auth/*, /users/me) aren't wired yet."""

from django.urls import include, path

urlpatterns = [
    path("", include("employees.urls")),
    path("", include("accounts.urls")),
]
