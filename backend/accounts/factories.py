import factory

from accounts.models import Permission, Role, RolePermission, User, UserPermissionOverride
from core.enums import RoleArchetype, ScopeTier


class RoleFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Role
        django_get_or_create = ("name",)

    name = factory.Sequence(lambda n: f"Role {n}")
    archetype = RoleArchetype.EMPLOYEE


class PermissionFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Permission
        django_get_or_create = ("code",)

    code = factory.Sequence(lambda n: f"test.permission.{n}")


class RolePermissionFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = RolePermission

    role = factory.SubFactory(RoleFactory)
    permission = factory.SubFactory(PermissionFactory)
    scope_tier = ScopeTier.SELF


class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User
        django_get_or_create = ("username",)

    username = factory.Sequence(lambda n: f"user{n}")
    email = factory.Sequence(lambda n: f"user{n}@example.com")
    role = factory.SubFactory(RoleFactory)


class UserPermissionOverrideFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = UserPermissionOverride

    user = factory.SubFactory(UserFactory)
    permission = factory.SubFactory(PermissionFactory)
    scope_tier = ScopeTier.SELF
    is_granted = True
