from django.urls import path
from rest_framework.routers import DefaultRouter

from accounts.auth_views import ChangePasswordView, LoginView, LogoutView, MeView, RefreshView
from accounts.session_views import MySessionDetailView, MySessionsView
from accounts.views import (
    PermissionViewSet,
    RolePermissionViewSet,
    RoleViewSet,
    UserPermissionOverrideViewSet,
    UserViewSet,
)

router = DefaultRouter()
router.register("roles", RoleViewSet, basename="role")
router.register("permissions", PermissionViewSet, basename="permission")
router.register("role-permissions", RolePermissionViewSet, basename="rolepermission")
router.register(
    "user-permission-overrides", UserPermissionOverrideViewSet, basename="userpermissionoverride"
)
router.register("users", UserViewSet, basename="user")

urlpatterns = [
    path("auth/login", LoginView.as_view(), name="auth-login"),
    path("auth/refresh", RefreshView.as_view(), name="auth-refresh"),
    path("auth/logout", LogoutView.as_view(), name="auth-logout"),
    path("users/me", MeView.as_view(), name="users-me"),
    path("users/me/change-password", ChangePasswordView.as_view(), name="change-password"),
    path("users/me/sessions", MySessionsView.as_view(), name="my-sessions"),
    path("users/me/sessions/<int:pk>", MySessionDetailView.as_view(), name="my-session-detail"),
    *router.urls,
]
