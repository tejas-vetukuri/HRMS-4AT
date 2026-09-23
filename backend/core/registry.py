"""Permission registry: how a module tells the core which permissions it owns.

A module declares them in code, in `<app>/rbac.py`, instead of hand-writing a
data migration:

    from core.enums import ScopeTier
    from core.registry import PermissionSpec, register_permissions

    register_permissions(
        PermissionSpec(
            "leave.read",
            "View leave requests",
            default_grants={"Employee": ScopeTier.SELF, "Manager": ScopeTier.MANAGER,
                            "HR Admin": ScopeTier.ALL},
        ),
        PermissionSpec("leave.approve", "Approve leave requests",
                       default_grants={"Manager": ScopeTier.MANAGER, "HR Admin": ScopeTier.ALL}),
    )

`<app>/rbac.py` is imported automatically at startup (core.apps.CoreConfig.ready)
and synced to the database after every `migrate`:

- The Permission row is created if it does not exist.
- `default_grants` (role name -> scope tier) are written ONLY when the
  permission is created for the first time. An admin who later widens, narrows
  or removes a role's grant keeps their change; a re-run never overwrites it.
- A role named in default_grants that does not exist is skipped, not an error,
  so a module can name roles an organisation has not created.

The registry is also what the startup check in core.checks compares view
permission codes against, so a typo in `required_permission` fails at startup
instead of silently locking everyone out.
"""

from dataclasses import dataclass, field

from core.enums import ScopeTier


@dataclass(frozen=True)
class PermissionSpec:
    code: str
    description: str = ""
    default_grants: dict = field(default_factory=dict)  # role name -> ScopeTier


_REGISTRY: dict[str, PermissionSpec] = {}


def register_permissions(*specs: PermissionSpec) -> None:
    for spec in specs:
        _validate(spec)
        existing = _REGISTRY.get(spec.code)
        if existing is not None and existing != spec:
            raise ValueError(
                f"Permission {spec.code!r} is registered twice with different definitions. "
                "A permission code has exactly one owning module."
            )
        _REGISTRY[spec.code] = spec


def _validate(spec: PermissionSpec) -> None:
    parts = spec.code.split(".")
    if len(parts) < 2 or not all(part and part == part.lower().strip() for part in parts):
        raise ValueError(
            f"Permission code {spec.code!r} must be lower-case dot-notation, "
            "'<module>.<action>' (for example 'leave.approve')."
        )
    for role_name, tier in spec.default_grants.items():
        if tier not in ScopeTier.values:
            raise ValueError(
                f"{spec.code}: default grant for {role_name!r} uses unknown scope tier {tier!r}. "
                f"Use one of {ScopeTier.values}."
            )


def registered_permissions() -> dict[str, PermissionSpec]:
    return dict(_REGISTRY)


def is_registered(code: str) -> bool:
    return code in _REGISTRY


def sync_registered_permissions() -> dict:
    """Bring the database in line with the registry. Idempotent. Returns a
    summary: which permissions were created and which default grants were
    written or skipped."""
    from accounts.models import Permission, Role, RolePermission

    summary = {"created": [], "grants_written": [], "grants_skipped": []}
    for spec in _REGISTRY.values():
        permission, created = Permission.objects.get_or_create(
            code=spec.code, defaults={"description": spec.description}
        )
        if not created:
            if spec.description and not permission.description:
                permission.description = spec.description
                permission.save(update_fields=["description"])
            continue

        summary["created"].append(spec.code)
        for role_name, tier in spec.default_grants.items():
            role = Role.objects.filter(name=role_name).first()
            if role is None:
                summary["grants_skipped"].append((spec.code, role_name))
                continue
            RolePermission.objects.get_or_create(
                role=role, permission=permission, defaults={"scope_tier": tier}
            )
            summary["grants_written"].append((spec.code, role_name, str(tier)))
    return summary
