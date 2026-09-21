"""Seed the 4 starter roles (defaults, not a ceiling — docs/REQUIREMENTS.md §0)
and a small representative permission set with per-permission scope tiers, to
prove the RolePermission/scope-tier wiring end-to-end. Most permission codes
belong to modules that don't exist yet (Leave, Expense, ...) and get seeded by
their own Phase 3+ migrations when those apps land — this seeds only what
primitives 1 & 2 (the employee record itself) already support.

Preserves today's effective behavior: Manager gets `manager`-tier scope (direct
reports only, no skip-level visibility) rather than `team`, per the existing
"direct reports only" resolution in docs/REQUIREMENTS.md's open questions.
Idempotent/re-runnable via get_or_create, since this runs in every environment.

Archetype assignment (see core.enums.RoleArchetype for why these 3 values and
not the 4 originally guessed): HR Admin -> superadmin, since the frontend's
org-wide Organization page is gated on exactly that archetype and HR Admin is
the role with ALL-tier employees.read; Finance -> admin, since Finance needs
Reports (gated on admin-or-superadmin) but not the full org directory;
Manager -> employee, since there's no dedicated frontend surface for it today
— manager-only data access is enforced entirely server-side via scope tier,
not by frontend archetype.
"""

from django.db import migrations

from core.enums import RoleArchetype, ScopeTier

STARTER_ROLES = [
    {"name": "Employee", "archetype": RoleArchetype.EMPLOYEE},
    {"name": "Manager", "archetype": RoleArchetype.EMPLOYEE},
    {"name": "HR Admin", "archetype": RoleArchetype.SUPERADMIN},
    {"name": "Finance", "archetype": RoleArchetype.ADMIN},
]

PERMISSIONS = [
    {"code": "employees.read", "description": "Read employee records"},
    {"code": "employees.write", "description": "Edit employee records"},
    {
        "code": "roles.manage",
        "description": (
            "Create/edit roles, grant or revoke permissions on them, and manage "
            "per-individual permission overrides. Not employee-keyed — scope "
            "tier is stored as ALL for schema consistency but isn't meaningful "
            "here (see core.scope.user_has_permission)."
        ),
    },
]

# (role name, permission code, scope tier)
ROLE_PERMISSIONS = [
    ("Employee", "employees.read", ScopeTier.SELF),
    ("Employee", "employees.write", ScopeTier.SELF),
    ("Manager", "employees.read", ScopeTier.MANAGER),
    ("HR Admin", "employees.read", ScopeTier.ALL),
    ("HR Admin", "employees.write", ScopeTier.ALL),
    ("HR Admin", "roles.manage", ScopeTier.ALL),
    ("Finance", "employees.read", ScopeTier.ALL),
]


def seed_starter_roles(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    Permission = apps.get_model("accounts", "Permission")
    RolePermission = apps.get_model("accounts", "RolePermission")

    roles_by_name = {}
    for row in STARTER_ROLES:
        role, _ = Role.objects.get_or_create(
            name=row["name"], defaults={"archetype": row["archetype"]}
        )
        roles_by_name[row["name"]] = role

    permissions_by_code = {}
    for row in PERMISSIONS:
        permission, _ = Permission.objects.get_or_create(
            code=row["code"], defaults={"description": row["description"]}
        )
        permissions_by_code[row["code"]] = permission

    for role_name, permission_code, scope_tier in ROLE_PERMISSIONS:
        RolePermission.objects.get_or_create(
            role=roles_by_name[role_name],
            permission=permissions_by_code[permission_code],
            defaults={"scope_tier": scope_tier},
        )


def unseed_starter_roles(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    Role.objects.filter(name__in=[row["name"] for row in STARTER_ROLES]).delete()


class Migration(migrations.Migration):
    dependencies = [("accounts", "0001_initial")]

    operations = [
        migrations.RunPython(seed_starter_roles, unseed_starter_roles),
    ]
