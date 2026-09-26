from core.enums import ScopeTier
from core.registry import PermissionSpec, register_permissions

# Everyone who can sign in may see and update their own profile.
_EVERYONE_SELF = {
    "Employee": ScopeTier.SELF,
    "Manager": ScopeTier.SELF,
    "HR Admin": ScopeTier.SELF,
    "Finance": ScopeTier.SELF,
    "Executive": ScopeTier.SELF,
}

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
    PermissionSpec(
        "employees.personal.read",
        "View employees' personal details (personal email, phone, date of birth, gender)",
        default_grants={"HR Admin": ScopeTier.ALL},
    ),
    PermissionSpec(
        "employees.personal.write",
        "Change employees' personal details",
        default_grants={"HR Admin": ScopeTier.ALL},
    ),
    PermissionSpec(
        "org.manage",
        "Manage the organisation structure: departments, teams, job titles, "
        "job families, levels, grades, positions, locations, "
        "legal entities, business units and cost centres",
        default_grants={"HR Admin": ScopeTier.ALL},
    ),
    PermissionSpec(
        "ess.profile.read", "View your own employee profile", default_grants=_EVERYONE_SELF
    ),
    PermissionSpec(
        "ess.profile.write",
        "Update your own contact details, date of birth and gender",
        default_grants=_EVERYONE_SELF,
    ),
)
