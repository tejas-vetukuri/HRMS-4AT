"""Approvals permissions. Creating a request and acting as its named approver or
requester needs no code — that authority is inherent in being the requester or
approver. `approvals.manage` is the oversight capability: see every request,
reassign a stuck one's approver, or force-resolve it (the escape hatch for when
the original approver is unavailable)."""

from core.enums import ScopeTier
from core.registry import PermissionSpec, register_permissions

register_permissions(
    PermissionSpec(
        "approvals.manage",
        "Oversee all approval requests — reassign or force-resolve",
        default_grants={"HR Admin": ScopeTier.ALL, "Finance": ScopeTier.ALL},
    ),
)
