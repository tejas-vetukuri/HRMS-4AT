"""Step 4: describe the endpoint once, and the core proves it honours RBAC.
Used by the live command (`manage.py verify_example_leave`) and by pytest."""

from core.conformance import ActionSpec, ScopedEndpoint
from example_leave.models import LeaveRequest

ENDPOINT = ScopedEndpoint(
    label="Example leave requests",
    list_url="/api/v1/example-leave/requests/",
    detail_url=lambda pk: f"/api/v1/example-leave/requests/{pk}/",
    read_permission="example_leave.read",
    create_record=lambda employee: LeaveRequest.objects.create(employee=employee).pk,
    write_permission="example_leave.write",
    create_payload={"reason": "Family event"},
    actions=[
        ActionSpec(
            "approve",
            lambda pk: f"/api/v1/example-leave/requests/{pk}/approve/",
            "example_leave.approve",
            audit_action="LeaveRequest.approved",
        )
    ],
)
