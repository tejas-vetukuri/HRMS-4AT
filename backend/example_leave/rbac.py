"""Step 1 of plugging in: declare the permissions this module owns, with the
default scope each starter role gets. Admins can change any of it later, and a
re-run of `migrate` never overwrites their changes (see core/registry.py)."""

from core.enums import ScopeTier
from core.registry import PermissionSpec, register_permissions

register_permissions(
    PermissionSpec(
        "example_leave.read",
        "View leave requests within the holder's scope",
        default_grants={
            "Employee": ScopeTier.SELF,
            "Manager": ScopeTier.MANAGER,
            "HR Admin": ScopeTier.ALL,
        },
    ),
    PermissionSpec(
        "example_leave.write",
        "Submit leave requests",
        default_grants={
            "Employee": ScopeTier.SELF,
            "Manager": ScopeTier.SELF,
            "HR Admin": ScopeTier.SELF,
        },
    ),
    PermissionSpec(
        "example_leave.approve",
        "Approve leave requests within the holder's scope",
        default_grants={"Manager": ScopeTier.MANAGER, "HR Admin": ScopeTier.ALL},
    ),
)
