from core.enums import ScopeTier
from core.registry import PermissionSpec, register_permissions

register_permissions(
    PermissionSpec(
        "roles.manage",
        "Administer roles, permission grants, per-person overrides and user accounts",
        default_grants={"HR Admin": ScopeTier.ALL},
    ),
)
