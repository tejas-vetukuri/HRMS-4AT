"""Startup checks that catch RBAC wiring mistakes before a single request is made.

Run automatically by `runserver`, `migrate` and `manage.py check`. Each check
turns something that would otherwise fail (or worse, silently succeed) at
request time into an error naming the view and the fix.

    core.E001  a view names a permission code that no app registers (typo, or
               the module forgot its rbac.py)
    core.E002  a view using a core permission class declares no required_permission
    core.E003  a custom @action on an employee-scoped view has no entry in
               action_permissions (it would otherwise be authorised by the
               view-wide code, e.g. read authorising approve)
    core.E004  an employee-scoped view exposes create/update/destroy but has no
               write_permission (read would otherwise authorise writing)
"""

from django.core.checks import Error, register
from django.urls import URLPattern, URLResolver, get_resolver

from core.permissions import WRITE_ACTIONS, HasPermissionCode, ScopedEmployeePermission
from core.registry import is_registered


def _view_classes():
    seen = set()

    def walk(patterns):
        for pattern in patterns:
            if isinstance(pattern, URLResolver):
                yield from walk(pattern.url_patterns)
            elif isinstance(pattern, URLPattern):
                cls = getattr(pattern.callback, "cls", None)
                if cls is not None and cls not in seen:
                    seen.add(cls)
                    yield cls

    yield from walk(get_resolver().url_patterns)


def _uses(cls, permission_class):
    return any(
        isinstance(p, type) and issubclass(p, permission_class)
        for p in getattr(cls, "permission_classes", [])
    )


@register()
def check_view_permission_codes(app_configs, **kwargs):
    errors = []
    for cls in _view_classes():
        strict = _uses(cls, ScopedEmployeePermission)
        if not (strict or _uses(cls, HasPermissionCode)):
            continue

        mapping = getattr(cls, "action_permissions", None)
        mapping = mapping if isinstance(mapping, dict) else {}
        default_code = getattr(cls, "required_permission", None)
        name = f"{cls.__module__}.{cls.__name__}"

        if not default_code and not mapping:
            errors.append(
                Error(
                    f"{name} uses a core permission class but sets no required_permission.",
                    hint="Set required_permission = '<module>.<action>' on the view.",
                    id="core.E002",
                )
            )

        write_code = getattr(cls, "write_permission", None)
        for code in {c for c in [default_code, write_code, *mapping.values()] if c}:
            if not is_registered(code):
                errors.append(
                    Error(
                        f"{name} requires permission {code!r}, which no app registers.",
                        hint="Declare it with register_permissions() in the owning app's rbac.py, "
                        "or fix the typo.",
                        id="core.E001",
                    )
                )

        if strict:
            exposed = [a for a in sorted(WRITE_ACTIONS) if hasattr(cls, a) and a not in mapping]
            if exposed and not write_code:
                errors.append(
                    Error(
                        f"{name} exposes {', '.join(exposed)} but sets no write_permission.",
                        hint="Set write_permission = '<module>.write' on the view, or restrict "
                        "it to read-only (ReadOnlyModelViewSet / list+retrieve mixins).",
                        id="core.E004",
                    )
                )

        if strict and hasattr(cls, "get_extra_actions"):
            for extra in cls.get_extra_actions():
                if extra.__name__ not in mapping:
                    errors.append(
                        Error(
                            f"{name}.{extra.__name__} is a custom action with no entry in "
                            "action_permissions.",
                            hint=f"Add action_permissions = {{'{extra.__name__}': "
                            "'<module>.<action>'}.",
                            id="core.E003",
                        )
                    )
    return errors
