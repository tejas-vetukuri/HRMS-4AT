from datetime import date
from io import StringIO

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from employees.factories import DepartmentFactory, EmployeeFactory
from employees.management.commands.seed_sample_org_data import sample_joining_date
from employees.models import BusinessUnit, CostCenter, LegalEntity

pytestmark = pytest.mark.django_db


def _run(*args):
    call_command("seed_sample_org_data", *args, stdout=StringIO())


def test_fills_only_the_gaps_and_labels_everything_as_sample():
    dept = DepartmentFactory()
    person = EmployeeFactory(department=dept, employee_code="S-1")

    _run()

    person.refresh_from_db()
    assert person.date_of_joining == sample_joining_date("S-1")
    assert person.business_unit.name.startswith("Sample BU - ")
    assert person.cost_center.name.startswith("SAMPLE-CC-")
    assert person.legal_entity is not None


def test_the_placeholder_date_is_stable_and_in_a_plausible_range():
    first, second = sample_joining_date("ABC-1"), sample_joining_date("ABC-1")

    assert first == second
    assert date(2015, 1, 1) <= first <= date(2025, 6, 30)
    assert sample_joining_date("ABC-2") != first


def test_never_overwrites_real_values():
    dept = DepartmentFactory()
    real_entity = LegalEntity.objects.create(name="Real Entity Ltd")
    real = EmployeeFactory(
        department=dept, date_of_joining=date(2019, 9, 9), legal_entity=real_entity
    )

    _run()

    real.refresh_from_db()
    assert real.date_of_joining == date(2019, 9, 9) and real.legal_entity == real_entity


def test_is_idempotent():
    EmployeeFactory(department=DepartmentFactory())

    _run()
    _run()

    assert BusinessUnit.objects.filter(name__startswith="Sample BU - ").count() == 3
    assert CostCenter.objects.filter(name__startswith="SAMPLE-CC-").count() >= 1


def test_someone_with_no_department_still_gets_a_date_but_no_unit():
    person = EmployeeFactory(department=None)

    _run()

    person.refresh_from_db()
    assert person.date_of_joining is not None
    assert person.business_unit is None and person.cost_center is None


def test_remove_takes_back_exactly_the_samples_and_leaves_real_values():
    dept = DepartmentFactory()
    sample = EmployeeFactory(department=dept, employee_code="S-2")
    real = EmployeeFactory(department=dept, employee_code="R-1", date_of_joining=date(2018, 1, 2))
    _run()

    _run("--remove")

    sample.refresh_from_db()
    real.refresh_from_db()
    assert sample.date_of_joining is None and sample.business_unit is None
    assert real.date_of_joining == date(2018, 1, 2)
    assert not BusinessUnit.objects.filter(name__startswith="Sample BU - ").exists()
    assert not CostCenter.objects.filter(name__startswith="SAMPLE-CC-").exists()


def test_refuses_to_run_under_production_settings(settings):
    settings.SETTINGS_MODULE = "config.settings.prod"

    with pytest.raises(CommandError, match="production"):
        _run()
