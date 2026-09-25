"""Step 1 of plugging into the core: declare onboarding's permissions and the
default scope each starter role gets. Admins can change these later; re-running
migrate never overwrites their changes (see core/registry.py)."""

from core.enums import ScopeTier
from core.registry import PermissionSpec, register_permissions

register_permissions(
    PermissionSpec(
        "onboarding.read",
        "View onboarding records, tasks and offer letters within the holder's scope",
        default_grants={
            "Employee": ScopeTier.SELF,
            "Manager": ScopeTier.MANAGER,
            "HR Admin": ScopeTier.ALL,
        },
    ),
    PermissionSpec(
        "onboarding.write",
        "Create or change onboarding records, tasks and offer letters",
        default_grants={"HR Admin": ScopeTier.ALL},
    ),
    PermissionSpec(
        "onboarding.manage",
        "Manage onboarding templates and background verification",
        default_grants={"HR Admin": ScopeTier.ALL},
    ),
)
