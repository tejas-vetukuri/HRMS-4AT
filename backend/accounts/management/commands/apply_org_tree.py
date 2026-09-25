"""Applies manager relationships from data/org_tree.csv (manager_email,
report_email) to Employee.manager. Idempotent — safe to re-run.

Same PII policy as import_employee_directory.py: data/org_tree.csv is
gitignored (backend/**/management/commands/data/) and lives in a private
location outside this public repo — fetch the current version from there,
never re-add it with -f.

This is a partial reconstruction from OrgTree.pdf (a chart export with several
sub-teams collapsed into "+N" badges rather than expanded) — 65 of 93 people
have a confirmed manager after running this; the rest keep manager=None until
an expanded chart or a plain list is available for them specifically. One
ambiguity (an employee with two candidate managers in the source chart) was
resolved by explicit confirmation, not guessed — see the git history of this
file's data for that decision if it needs revisiting.
"""

import csv
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from employees.models import Employee

CSV_PATH = Path(__file__).parent / "data" / "org_tree.csv"


class Command(BaseCommand):
    help = "Apply manager relationships from data/org_tree.csv to Employee.manager."

    def handle(self, *args, **options):
        if not CSV_PATH.exists():
            raise CommandError(
                f"{CSV_PATH} not found — fetch it from its private location first "
                "(see this command's docstring)."
            )

        rows = list(csv.DictReader(CSV_PATH.open(encoding="utf-8-sig")))
        self.stdout.write(f"Loaded {len(rows)} manager relationships from {CSV_PATH.name}")

        updated, unchanged, missing = 0, 0, []

        with transaction.atomic():
            for row in rows:
                manager_email = row["manager_email"].strip()
                report_email = row["report_email"].strip()

                manager = Employee.objects.filter(user__email__iexact=manager_email).first()
                report = Employee.objects.filter(user__email__iexact=report_email).first()

                if manager is None or report is None:
                    missing.append((manager_email, report_email))
                    continue

                if report.manager_id != manager.id:
                    report.manager = manager
                    report.save(update_fields=["manager"])
                    updated += 1
                else:
                    unchanged += 1

        self.stdout.write(
            self.style.SUCCESS(f"Done. {updated} updated, {unchanged} already correct.")
        )
        if missing:
            self.stdout.write(
                self.style.WARNING(
                    f"{len(missing)} row(s) referenced an email not found in Employee — "
                    "run import_employee_directory first if this roster changed:"
                )
            )
            for m, r in missing:
                self.stdout.write(f"  manager={m} report={r}")

        without_manager = Employee.objects.filter(manager__isnull=True).count()
        self.stdout.write(
            f"{without_manager} employees currently have no manager set "
            "(root of the chart, or not yet covered by org_tree.csv)."
        )
