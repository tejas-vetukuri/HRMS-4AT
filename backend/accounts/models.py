"""Primitive #2 — RBAC + scope resolver. See docs/ARCHITECTURE.md primitive 2 and
docs/REQUIREMENTS.md §0 for the product-level design this implements.

Roles are admin-creatable, not a fixed set (P1-E1-12 wires CRUD on top of these
models). Permission *codes* are still declared in code by whichever module owns
that action; what's admin-configurable is which role/individual holds which code,
at what scope tier. Scope itself is resolved by core.scope.resolve_employee_scope,
not by anything in this module — these models only store the assignment.
"""

from django.contrib.auth.models import AbstractUser
from django.db import models

from core.enums import RoleArchetype, ScopeTier


class Role(models.Model):
    """Admin-creatable. The 4 starter roles (Employee/Manager/HR Admin/Finance)
    are seeded defaults, not a hardcoded ceiling — see docs/REQUIREMENTS.md §0."""

    name = models.CharField(max_length=100, unique=True)
    archetype = models.CharField(
        max_length=20,
        choices=RoleArchetype.choices,
        help_text=(
            "Which of the frontend's 3 known UI archetypes this role renders as "
            "(employee/admin/superadmin — see core.enums.RoleArchetype for why "
            "not 4). The frontend is unmodified and only understands these 3 "
            "(docs/TASKS.md P1-E3-01) so every role — starter or custom — must "
            "declare one, even a brand-new custom role."
        ),
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Permission(models.Model):
    """Enumerated permission strings in dot-notation (leave.approve,
    expense.write, ...). Declared by the module that owns the action being
    gated — not admin-creatable through any UI."""

    code = models.CharField(max_length=150, unique=True)
    description = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["code"]

    def __str__(self):
        return self.code


class RolePermission(models.Model):
    """(role, permission) -> scope tier. Scope is set per permission per role,
    not once per role — the same role can hold one permission at Team scope and
    another at Department scope."""

    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="role_permissions")
    permission = models.ForeignKey(
        Permission, on_delete=models.CASCADE, related_name="role_permissions"
    )
    scope_tier = models.CharField(max_length=20, choices=ScopeTier.choices)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["role", "permission"], name="unique_role_permission")
        ]
        ordering = ["role__name", "permission__code"]

    def __str__(self):
        return f"{self.role.name}: {self.permission.code} @ {self.scope_tier}"


class User(AbstractUser):
    """Single role per user via a direct FK (a DB constraint, not a convention) —
    see docs/ARCHITECTURE.md primitive 2 for why this isn't M2M. Per-individual
    customization goes through UserPermissionOverride below, not multiple roles.

    `email` is overridden unique — the frontend contract logs in with
    `{email, password}` (frontend/src/app/api/auth/login/route.ts), so the
    login view looks users up by email directly rather than through
    AbstractUser's non-unique default."""

    email = models.EmailField(unique=True)
    role = models.ForeignKey(
        Role, null=True, blank=True, on_delete=models.PROTECT, related_name="users"
    )

    def __str__(self):
        return self.get_username()


class UserPermissionOverride(models.Model):
    """Per-individual grant or restriction on top of the user's role. An override
    on a given (user, permission) always wins over that role's own RolePermission
    row, whether it widens access (is_granted=True at a broader tier) or narrows
    it (is_granted=False denies the permission outright for this one person)."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="permission_overrides")
    permission = models.ForeignKey(
        Permission, on_delete=models.CASCADE, related_name="user_overrides"
    )
    scope_tier = models.CharField(max_length=20, choices=ScopeTier.choices)
    is_granted = models.BooleanField(
        default=True,
        help_text="False explicitly denies this permission for this user, "
        "overriding what their role would otherwise give them.",
    )
    created_by = models.ForeignKey(
        User,
        null=True,
        on_delete=models.SET_NULL,
        related_name="created_permission_overrides",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "permission"], name="unique_user_permission_override"
            )
        ]
        ordering = ["user__username", "permission__code"]

    def __str__(self):
        verb = "grant" if self.is_granted else "deny"
        return f"{self.user}: {verb} {self.permission.code} @ {self.scope_tier}"


class FailedLoginAttempt(models.Model):
    """Tracked per account, not per IP — that's the login throttle's job
    (config.settings.base's DEFAULT_THROTTLE_RATES['login']), a different
    defense against a different attack (one IP hammering many accounts vs.
    many attempts against one account). LoginView checks the count within the
    trailing LOCKOUT_WINDOW before authenticating; see accounts/auth_views.py."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="failed_login_attempts")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "created_at"])]
