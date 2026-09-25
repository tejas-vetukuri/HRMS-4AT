"""Fill the gaps in the existing employee data with clearly-labelled SAMPLE values,
so the organisation screens have something to show while real data is collected.

    python manage.py seed_sample_org_data            # fill the gaps (idempotent)
    python manage.py seed_sample_org_data --remove   # take the sample values back out

What it does, for employees that have no value yet (it never overwrites a real one):

- business unit: three sample units ("Sample BU - ..."), assigned by department
- cost centre: one sample cost centre per department ("SAMPLE-CC-..."), by department
- date of joining: a placeholder date between 2015 and mid-2025, worked out from the
  employee code so the same person always gets the same date
- legal entity: the default legal entity, for anyone with none

The dates are placeholders, not real. Real dates come from HR (the import or the
admin screens) and simply replace them. `--remove` clears exactly the values this
command would have written (the sample business units and cost centres, and any joining
date that still equals its placeholder). Real values are left alone. It does not undo the
legal entity assignment. Dev and test only.
"""

import hashlib
from datetime import date, timedelta

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from employees.models import BusinessUnit, CostCenter, Department, Employee, LegalEntity

BU_PREFIX = "Sample BU - "
CC_PREFIX = "SAMPLE-CC-"
BUSINESS_UNITS = ["Technology", "Operations", "Corporate"]

_START = date(2015, 1, 1)
_SPAN_DAYS = (date(2025, 6, 30) - _START).days


def sample_joining_date(employee_code: str) -> date:
    """A stable placeholder joining date for one employee code."""
    digest = int(hashlib.sha256(employee_code.encode("utf-8")).hexdigest(), 16)
    return _START + timedelta(days=digest % _SPAN_DAYS)


class Command(BaseCommand):
    help = "Fill empty org fields with labelled sample values (or remove them with --remove)."

    def add_arguments(self, parser):
        parser.add_argument("--remove", action="store_true", help="Remove the sample values.")

    @transaction.atomic
    def handle(self, *args, **options):
        if settings.SETTINGS_MODULE.endswith(".prod"):
            raise CommandError("seed_sample_org_data does not run under production settings.")
        if options["remove"]:
            return self._remove()
        self._fill()

    # -- fill ---------------------------------------------------------------

    def _fill(self):
        units = [
            BusinessUnit.objects.get_or_create(name=f"{BU_PREFIX}{name}")[0]
            for name in BUSINESS_UNITS
        ]
        entity = LegalEntity.objects.order_by("id").first()
        cost_centers = {}
        counts = dict.fromkeys(
            ["business_unit", "cost_center", "date_of_joining", "legal_entity"], 0
        )

        for department in Department.objects.order_by("id"):
            cost_centers[department.pk] = CostCenter.objects.get_or_create(
                name=f"{CC_PREFIX}{department.pk:03d} {department.name}"[:150],
                defaults={"code": f"{CC_PREFIX}{department.pk:03d}"},
            )[0]

        for employee in Employee.objects.select_related("department"):
            changed = []
            if employee.department_id:
                if employee.business_unit_id is None:
                    employee.business_unit = units[employee.department_id % len(units)]
                    changed.append("business_unit")
                if employee.cost_center_id is None:
                    employee.cost_center = cost_centers[employee.department_id]
                    changed.append("cost_center")
            if employee.date_of_joining is None:
                employee.date_of_joining = sample_joining_date(employee.employee_code)
                changed.append("date_of_joining")
            if employee.legal_entity_id is None and entity is not None:
                employee.legal_entity = entity
                changed.append("legal_entity")
            if changed:
                employee.save(update_fields=changed)
                for name in changed:
                    counts[name] += 1

        total = Employee.objects.count()
        self.stdout.write(f"Sample values written for {total} employees in the directory:")
        for name, n in counts.items():
            self.stdout.write(f"  {name:<16} filled for {n}")
        self.stdout.write(self.style.SUCCESS("Done. These are placeholders; undo with --remove."))

    # -- remove ---------------------------------------------------------------

    def _remove(self):
        cleared_dates = 0
        for employee in Employee.objects.exclude(date_of_joining=None):
            if employee.date_of_joining == sample_joining_date(employee.employee_code):
                employee.date_of_joining = None
                employee.save(update_fields=["date_of_joining"])
                cleared_dates += 1
        Employee.objects.filter(business_unit__name__startswith=BU_PREFIX).update(
            business_unit=None
        )
        Employee.objects.filter(cost_center__name__startswith=CC_PREFIX).update(cost_center=None)
        BusinessUnit.objects.filter(name__startswith=BU_PREFIX).delete()
        CostCenter.objects.filter(name__startswith=CC_PREFIX).delete()
        self.stdout.write(
            self.style.SUCCESS(
                f"Removed the sample business units and cost centres and {cleared_dates} "
                "placeholder joining dates. Legal entity assignments were left in place."
            )
        )
