from core.enums import ScopeTier
from core.registry import PermissionSpec, register_permissions

register_permissions(
    PermissionSpec(
        "audit.read",
        "View the activity log (who did what, and when)",
        default_grants={"HR Admin": ScopeTier.ALL},
    ),
)
