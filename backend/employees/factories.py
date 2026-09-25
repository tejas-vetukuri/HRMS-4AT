import factory

from accounts.factories import UserFactory
from employees.models import Department, Employee, LegalEntity, Location


class DepartmentFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Department
        django_get_or_create = ("name",)

    name = factory.Sequence(lambda n: f"Department {n}")


class LocationFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Location
        django_get_or_create = ("name",)

    name = factory.Sequence(lambda n: f"Location {n}")


class LegalEntityFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = LegalEntity
        django_get_or_create = ("name",)

    name = factory.Sequence(lambda n: f"Legal Entity {n}")


class EmployeeFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Employee

    user = factory.SubFactory(UserFactory)
    employee_code = factory.Sequence(lambda n: f"EMP{n:05d}")
