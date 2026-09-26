"""Describe the payroll endpoint once; the core proves it honours RBAC scoping.
Used by `manage.py verify_payroll` and by pytest.

Payroll records are assigned by Finance, not self-submitted like leave, so the
create-owner check (which assumes the caller is the owner) is not applicable —
`create_payload` is left None. The guarantee under test is READ scoping: an
Employee sees only their own compensation, a Manager their team's, HR/Finance
everyone's (the IDOR this module's FK + resolve_employee_scope closes)."""

import datetime

from core.conformance import ScopedEndpoint
from payroll.models import EmployeeCompensation

ENDPOINT = ScopedEndpoint(
    label="Employee compensation",
    list_url="/api/v1/payroll/inputs/compensation/",
    detail_url=lambda pk: f"/api/v1/payroll/inputs/compensation/{pk}/",
    read_permission="payroll.read",
    create_record=lambda employee: EmployeeCompensation.objects.create(
        employee=employee,
        fixed_monthly_amount=50000,
        effective_from=datetime.date(2026, 1, 1),
    ).pk,
    write_permission="payroll.write",
)
