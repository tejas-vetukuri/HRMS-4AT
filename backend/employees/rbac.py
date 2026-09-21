from core.enums import ScopeTier
from core.registry import PermissionSpec, register_permissions

register_permissions(
    PermissionSpec(
        "employees.read",
        "View employee directory records within the holder's scope",
        default_grants={
            "Employee": ScopeTier.SELF,
            "Manager": ScopeTier.MANAGER,
            "HR Admin": ScopeTier.ALL,
            "Finance": ScopeTier.ALL,
        },
    ),
    PermissionSpec(
        "employees.write",
        "Create and change employee directory records within the holder's scope",
        default_grants={"HR Admin": ScopeTier.ALL},
    ),
)
