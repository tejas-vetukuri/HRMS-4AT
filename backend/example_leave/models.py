from django.db import models


class LeaveRequest(models.Model):
    """The one thing that makes a model plug into the core: an FK named
    `employee` to employees.Employee. ScopedEmployeePermission scope-checks
    every record through it."""

    employee = models.ForeignKey(
        "employees.Employee", on_delete=models.CASCADE, related_name="example_leave_requests"
    )
    reason = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=20, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-id"]
