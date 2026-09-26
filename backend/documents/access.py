"""The heart of the documents primitive: a per-entity_type access matrix.
Access to a file is decided here, not by ad-hoc checks in each caller.

For each entity_type: `owner` means the employee whose id equals the document's
entity_id may access their own file, and `permissions` lists RBAC codes any of
which also grants access (checked through primitive #2's effective-permission
set). An unknown entity_type is denied — a new document kind must be declared
here before its files can be read or written."""

from core.scope import resolve_employee_scope, user_effective_permissions

ACCESS_MATRIX: dict[str, dict] = {
    # A payslip: the employee it belongs to, plus payroll/HR reads.
    "payslip": {"owner": True, "permissions": ["payroll.read", "payroll.manage"]},
    # An identity document: the employee, plus HR who manage personal data.
    "id_document": {"owner": True, "permissions": ["employees.personal.read"]},
    # A generic employee document (contracts, letters): employee + HR.
    "employee_document": {"owner": True, "permissions": ["employees.personal.read"]},
    # Org-wide documents (policies) — any HR/org manager, not employee-owned.
    "org_document": {"owner": False, "permissions": ["org.manage", "employees.write"]},
}


def can_access(user, entity_type: str, entity_id: str) -> bool:
    """Whether `user` may read or write documents of (entity_type, entity_id)."""
    rule = ACCESS_MATRIX.get(entity_type)
    if rule is None:
        return False
    if rule.get("owner"):
        employee = getattr(user, "employee", None)
        if employee is not None and str(employee.pk) == str(entity_id):
            return True
    codes = user_effective_permissions(user)
    granted = [code for code in rule.get("permissions", []) if code in codes]
    if not rule.get("owner"):
        return bool(granted)
    # Employee-owned files: a permission only reaches the employees inside the
    # caller's scope for it. An Employee holds payroll.read at self scope, so
    # without this check any employee could open another employee's payslip.
    if not str(entity_id).isdigit():
        return False
    return any(resolve_employee_scope(user, code).filter(pk=entity_id).exists() for code in granted)
