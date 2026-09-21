"""Primitive #1 — the Employee/org table. See docs/ARCHITECTURE.md primitive 1.

Department, Location, and Legal Entity are the org dimensions the scope tiers in
core.scope dispatch on (alongside the manager self-FK, which backs the `manager`
and `team` tiers). Designation is descriptive org data with no scope tier of its
own. All four support models use is_active soft-delete — never hard-delete, since
historical Employee records may still reference a since-retired one.
"""

from django.conf import settings
from django.db import models

from core.enums import EmployeeStatus, EmploymentType


class SoftDeleteNamedModel(models.Model):
    """Shared shape for the small reference tables below: a unique name and an
    is_active flag instead of ever hard-deleting a row a historical Employee
    might still point to."""

    name = models.CharField(max_length=150, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
        ordering = ["name"]

    def __str__(self):
        return self.name


class Department(SoftDeleteNamedModel):
    """Two-level in practice (e.g. "Audit & Assurance" -> "InfoSec Audit") —
    `parent` is nullable so a top-level department (or one with no
    sub-department) is just a Department with parent=None."""

    parent = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.PROTECT, related_name="children"
    )


class Designation(SoftDeleteNamedModel):
    pass


class Location(SoftDeleteNamedModel):
    pass


class LegalEntity(SoftDeleteNamedModel):
    """The company operates as a single legal entity today — exactly one row is
    seeded (see employees/migrations for the seed migration) — but this is a real
    table from day one so a second entity is a data change, not a schema change."""


class BusinessUnit(SoftDeleteNamedModel):
    """A line of business or division that cuts across departments."""


class CostCenter(SoftDeleteNamedModel):
    """A budget line employees are charged to. `code` is the finance code."""

    code = models.CharField(max_length=30, blank=True)


class Employee(models.Model):
    """The one model every other module in the system references. `manager` is
    the self-referencing FK the `manager` (direct reports) and `team` (full
    transitive subtree) scope tiers resolve against; `department`/`location`/
    `legal_entity` back their respective tiers. All three are nullable since an
    employee can exist before every dimension is assigned."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="employee"
    )
    manager = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="direct_reports",
    )
    department = models.ForeignKey(
        Department, null=True, blank=True, on_delete=models.PROTECT, related_name="employees"
    )
    designation = models.ForeignKey(
        Designation, null=True, blank=True, on_delete=models.PROTECT, related_name="employees"
    )
    location = models.ForeignKey(
        Location, null=True, blank=True, on_delete=models.PROTECT, related_name="employees"
    )
    legal_entity = models.ForeignKey(
        LegalEntity, null=True, blank=True, on_delete=models.PROTECT, related_name="employees"
    )
    business_unit = models.ForeignKey(
        BusinessUnit, null=True, blank=True, on_delete=models.PROTECT, related_name="employees"
    )
    cost_center = models.ForeignKey(
        CostCenter, null=True, blank=True, on_delete=models.PROTECT, related_name="employees"
    )
    status = models.CharField(
        max_length=20, choices=EmployeeStatus.choices, default=EmployeeStatus.ACTIVE
    )
    employment_type = models.CharField(
        max_length=20, choices=EmploymentType.choices, default=EmploymentType.FULL_TIME
    )
    employee_code = models.CharField(max_length=50, unique=True)

    # Lifecycle. date_of_exit and exit_reason are set when status becomes
    # `exited` and cleared if the person returns.
    date_of_joining = models.DateField(null=True, blank=True)
    date_of_exit = models.DateField(null=True, blank=True)
    exit_reason = models.CharField(max_length=200, blank=True)

    # Personal details. Not part of the ordinary directory: readable only with
    # employees.personal.read, editable by the person themselves (self-service)
    # or with employees.personal.write.
    personal_email = models.EmailField(blank=True)
    phone = models.CharField(max_length=30, blank=True)
    dob = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=20, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["employee_code"]

    def __str__(self):
        return f"{self.employee_code} ({self.user.get_username()})"
