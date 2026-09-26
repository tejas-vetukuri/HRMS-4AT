# Building a module on the core

For anyone adding Attendance, Leave, Payroll or any other module. The core gives
you roles, scope tiers, the employee directory, audit and authentication; you
declare what your module needs and the core enforces it and proves it.

`example_leave/` is a complete, working reference module. Copy it. Everything
below points at a real file there.

## The five steps

**1. Add your app to `INSTALLED_APPS`** (`config/settings/base.py`). That is the
only core file you edit. Your routes and permissions are discovered automatically.

**2. Declare your permissions in `<app>/rbac.py`.** No hand-written migration.

```python
from core.enums import ScopeTier
from core.registry import PermissionSpec, register_permissions

register_permissions(
    PermissionSpec("leave.read", "View leave requests within scope",
                   default_grants={"Employee": ScopeTier.SELF,
                                   "Manager": ScopeTier.MANAGER,
                                   "HR Admin": ScopeTier.ALL}),
    PermissionSpec("leave.write", "Submit leave requests",
                   default_grants={"Employee": ScopeTier.SELF}),
    PermissionSpec("leave.approve", "Approve leave requests within scope",
                   default_grants={"Manager": ScopeTier.MANAGER, "HR Admin": ScopeTier.ALL}),
)
```

`python manage.py migrate` creates the permissions and the default grants. The
grants are written once, when the permission is first created: an admin who later
changes or removes one keeps that change across every future `migrate`. Codes are
lower-case `<module>.<action>` and belong to exactly one module.

**3. Give employee-owned models an FK named `employee`** to `employees.Employee`.
The core scope-checks every record through it.

**4. Write the view.** Everything the core needs is a class attribute:

```python
class LeaveRequestViewSet(mixins.CreateModelMixin, mixins.ListModelMixin,
                          mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = [ScopedEmployeePermission]
    required_permission = "leave.read"                    # list, retrieve
    write_permission = "leave.write"                      # create/update/destroy
    action_permissions = {"approve": "leave.approve"}     # every custom @action

    def get_queryset(self):
        qs = LeaveRequest.objects.all()
        if self.action == "list":                         # lists must be filtered by scope
            return qs.filter(employee_id__in=resolve_employee_scope(self.request.user, self.required_permission))
        return qs                                         # detail routes are checked per object

    def perform_create(self, serializer):
        serializer.save(employee=self.request.user.employee)   # the caller, never the request body
```

Then write an audit entry for every mutation with
`audit.service.write_audit(actor, "LeaveRequest.approved", "LeaveRequest", pk)`.

**5. Expose routes in `<app>/api_urls.py`** as `urlpatterns`. They are mounted
under `/api/v1/` automatically.

## Prove it works

Describe your endpoint once in `<app>/conformance.py` (see
`example_leave/conformance.py`), then:

```python
# management/commands/verify_leave.py: a live, visible run
class Command(VerificationCommand):
    def verify(self, v):
        run_conformance(v, FictionalOrg.build(), ENDPOINT)

# tests/test_conformance.py: the same checks, silent, in CI
def test_leave_conforms():
    assert_module_conforms(ENDPOINT)
```

```bash
python manage.py verify_leave --html --open     # watch it, get a report in the browser
```

It checks against a known fictional company, with expectations written by hand
rather than computed by the code under test: your permissions are registered;
anonymous callers get 401 and permission-less callers 403; **for all seven scope
tiers** a list returns exactly the right people's records; in-scope records open
and out-of-scope ones are 403; a per-person deny beats a role grant; create needs
the write permission and always belongs to the caller; each custom action needs its
own permission, is scope-checked per record and writes the audit entry you named.
`example_leave/tests/test_conformance.py` shows the kit failing when a module is
deliberately broken, which is what makes a pass mean something.

## Mistakes the core catches at startup

`manage.py check` (and so `runserver`, `migrate` and CI) refuses to start if:

| Code | Mistake |
|---|---|
| `core.E001` | a view names a permission that no app registers (typo, or missing `rbac.py`) |
| `core.E002` | a view uses a core permission class but sets no `required_permission` |
| `core.E003` | a custom `@action` has no entry in `action_permissions` |
| `core.E004` | the view exposes create/update/destroy but sets no `write_permission` |

E003 and E004 exist because the alternative is silent privilege escalation: with a
single permission, holding `leave.read` would also let you approve or delete.

## Response shapes

- **Errors** are the same everywhere and need no code from you: raise a DRF
  exception and the client gets `{"success": false, "error": {"code", "message", "fields"}}`.
- **Success** is whatever your frontend page reads. The directory pages read
  `{success, data}` with snake_case fields; `core.api.FrontendEnvelopeMixin` does
  that wrapping if your pages need the same. Check the page's source, not the docs.

## Checklist before opening a pull request

- [ ] `manage.py check` passes
- [ ] `<app>/rbac.py` registers every permission the module uses
- [ ] every employee-owned list is filtered by `resolve_employee_scope`
- [ ] every custom action is in `action_permissions`; writes have `write_permission`
- [ ] the owner of a new record comes from `request.user.employee`, not the body
- [ ] every mutation calls `write_audit`
- [ ] `verify_<module>` passes and `assert_module_conforms` is in the test suite
- [ ] `ruff check .`, `black --check .` and `pytest` pass
