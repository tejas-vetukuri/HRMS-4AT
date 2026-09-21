"""DRF permission classes built on core.scope. Two flavors:

- ScopedEmployeePermission: for views over employee-keyed data. Views declare
  `required_permission = "leave.read"` for the standard actions, and must map
  every custom @action to its own code — `action_permissions = {"approve":
  "leave.approve"}` — or the request fails loudly rather than being
  authorised by the read permission. List actions must filter their own
  queryset via resolve_employee_scope() (this class doesn't do it for them,
  since only the view knows which field to filter on); retrieve/update/destroy
  get an explicit has_object_permission check against that same scope, so an
  out-of-scope object is a 403, not a queryset-filtered 404. Only covers
  routes that go through `get_object()` (detail routes) — a custom
  non-detail @action that queries Employee-keyed rows directly must call
  resolve_employee_scope() itself; has_permission() alone only confirms the
  caller holds the permission at some scope, not which records it covers.

- HasPermissionCode: for views that aren't employee-keyed at all (e.g.
  managing Role/Permission rows themselves) — a flat "does this user hold this
  permission" check, no scope filtering.
"""

from django.core.exceptions import ImproperlyConfigured
from rest_framework.permissions import BasePermission

from core.scope import resolve_employee_scope, user_has_permission
from employees.models import Employee

# DRF's built-in ModelViewSet actions. Anything else is a custom @action
# (approve, cancel, bulk_x, ...) and is a different privilege from reading.
STANDARD_ACTIONS = frozenset({"list", "retrieve", "create", "update", "partial_update", "destroy"})
# The standard actions that change data. Reading a record must never authorise
# these, so employee-scoped views declare `write_permission` (or map each one in
# `action_permissions`).
WRITE_ACTIONS = frozenset({"create", "update", "partial_update", "destroy"})


def required_permission_for(view, *, strict: bool = False) -> str:
    """The permission code the current request's action requires.

    `required_permission` is the default for reading (list/retrieve).
    `write_permission` covers create/update/partial_update/destroy on
    employee-scoped views. A view whose actions need *different* codes
    declares `action_permissions = {"approve": "leave.approve"}` — without it,
    an `approve` action would be authorised by whatever the view-wide code
    is (typically `leave.read`), letting anyone who can read a request
    approve it. Found by exercising a stand-in plugin against this layer,
    where an Employee holding only `leave.read` approved their own leave
    request.

    strict=True (used by ScopedEmployeePermission, i.e. employee-keyed views)
    refuses to fall back to the view-wide code for a custom action: it must
    be mapped explicitly, or the request fails loudly. Flat capability views
    (HasPermissionCode, e.g. everything under roles.manage) keep one code
    for all actions on purpose."""
    mapping = getattr(view, "action_permissions", None)
    if not isinstance(mapping, dict):
        mapping = {}
    action = getattr(view, "action", None)
    if not isinstance(action, str):
        action = None

    if action in mapping:
        return mapping[action]
    if strict and action in WRITE_ACTIONS:
        write_code = getattr(view, "write_permission", None)
        if isinstance(write_code, str) and write_code:
            return write_code
        raise ImproperlyConfigured(
            f"{view.__class__.__name__}.{action}: a write action has no permission of its own. "
            "ScopedEmployeePermission will not authorise it with the read `required_permission`. "
            "Set `write_permission = '<module>.write'` on the view (or map the action in "
            "`action_permissions`), or make the view read-only."
        )
    if strict and action is not None and action not in STANDARD_ACTIONS:
        raise ImproperlyConfigured(
            f"{view.__class__.__name__}.{action}: custom action has no entry in "
            "`action_permissions`. ScopedEmployeePermission will not authorise it with the "
            "view-wide `required_permission`, since that would let e.g. a read permission "
            "authorise a write. Add {'%s': '<module>.<verb>'} to action_permissions." % action
        )

    code = getattr(view, "required_permission", None)
    if not code:
        raise ImproperlyConfigured(
            f"{view.__class__.__name__} must set `required_permission` to use "
            "a core.permissions permission class."
        )
    return code


def _required_permission(view) -> str:
    return required_permission_for(view)


class HasPermissionCode(BasePermission):
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        return user_has_permission(request.user, _required_permission(view))


class ScopedEmployeePermission(BasePermission):
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        return user_has_permission(request.user, required_permission_for(view, strict=True))

    def has_object_permission(self, request, view, obj):
        code = required_permission_for(view, strict=True)
        # `obj` isn't always an Employee — a future module's LeaveRequest,
        # ExpenseClaim, etc. are "employee-keyed" via their own FK, not by
        # being one. Comparing obj.pk straight to the Employee scope
        # queryset would silently compare unrelated pk namespaces (a
        # LeaveRequest and an Employee that happen to share a pk) and
        # reintroduce exactly the IDOR this module exists to close.
        if isinstance(obj, Employee):
            employee_id = obj.pk
        else:
            employee_id = getattr(obj, "employee_id", None)
        if employee_id is None:
            raise ImproperlyConfigured(
                f"{view.__class__.__name__}: ScopedEmployeePermission needs `obj` to be an "
                "Employee or to expose an `employee_id` FK to scope-check against; "
                f"{obj.__class__.__name__} has neither."
            )
        return resolve_employee_scope(request.user, code).filter(pk=employee_id).exists()
