"""Two different contracts live in this file, deliberately:

- EmployeeSerializer / the NamedEntity serializers below match
  employees/page.tsx, org/page.tsx, and profile/page.tsx's actual Employee
  and NamedEntity TypeScript interfaces exactly — snake_case field names,
  string ids — verified by reading the frontend source directly, not
  assumed from docs. This is a deliberate, isolated exception to the
  project's general camelCase convention (correctly used everywhere else:
  auth, RBAC/accounts). See employees/views.py's FrontendEnvelopeMixin for
  the matching {success, data} response wrapping this requires.
- No salary/bank fields here either way — those land in Phase 2 gated to
  hr_admin/finance only (docs/TASKS.md P2-E1-01); this serializer only ever
  exposes what P1-E1-04's Employee model actually carries.
"""

from django.contrib.auth import get_user_model
from rest_framework import serializers

from accounts.models import Role
from core.enums import EmployeeStatus
from employees.models import Department, Designation, Employee, LegalEntity, Location

User = get_user_model()


class _NamedEntitySerializer(serializers.ModelSerializer):
    """{id, name} — matches frontend/src/app/(app)/*/page.tsx's NamedEntity
    interface exactly. `id` as a string, not DRF's default integer, since
    that's the interface's declared type."""

    id = serializers.SerializerMethodField()

    class Meta:
        fields = ["id", "name"]

    def get_id(self, obj):
        return str(obj.pk)


class DepartmentSerializer(_NamedEntitySerializer):
    class Meta(_NamedEntitySerializer.Meta):
        model = Department


class DesignationSerializer(_NamedEntitySerializer):
    class Meta(_NamedEntitySerializer.Meta):
        model = Designation


class LocationSerializer(_NamedEntitySerializer):
    class Meta(_NamedEntitySerializer.Meta):
        model = Location


class LegalEntitySerializer(_NamedEntitySerializer):
    class Meta(_NamedEntitySerializer.Meta):
        model = LegalEntity


class EmployeeSerializer(serializers.ModelSerializer):
    """Matches employees/page.tsx's `Employee` interface field-for-field:
    first_name/last_name (not full_name), work_email (not email), and
    *_id foreign keys as bare string ids (the page resolves names itself via
    separate department/designation/location NamedEntity lookups — see
    toNameMap in that file)."""

    id = serializers.SerializerMethodField()
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)
    work_email = serializers.EmailField(source="user.email", read_only=True)
    department_id = serializers.SerializerMethodField()
    designation_id = serializers.SerializerMethodField()
    location_id = serializers.SerializerMethodField()
    manager_id = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = [
            "id",
            "employee_code",
            "first_name",
            "last_name",
            "work_email",
            "department_id",
            "designation_id",
            "location_id",
            "manager_id",
            "status",
        ]

    def get_id(self, obj):
        return str(obj.pk)

    def get_department_id(self, obj):
        return str(obj.department_id) if obj.department_id else None

    def get_designation_id(self, obj):
        return str(obj.designation_id) if obj.designation_id else None

    def get_location_id(self, obj):
        return str(obj.location_id) if obj.location_id else None

    def get_manager_id(self, obj):
        return str(obj.manager_id) if obj.manager_id else None


def _reference(model, source):
    return serializers.PrimaryKeyRelatedField(
        source=source, queryset=model.objects.all(), required=False, allow_null=True
    )


class EmployeeWriteSerializer(serializers.Serializer):
    """Input for creating and editing an employee (PATCH is partial).

    Deliberately has no role field: assigning a role is `roles.manage`, a
    different privilege from `employees.write`, so a directory editor cannot
    promote anyone. New accounts get the default Employee role and an unusable
    password (no login until a password is set through the reset flow)."""

    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    work_email = serializers.EmailField()
    employee_code = serializers.CharField(max_length=50)
    status = serializers.ChoiceField(choices=EmployeeStatus.choices, required=False)
    department_id = _reference(Department, "department")
    designation_id = _reference(Designation, "designation")
    location_id = _reference(Location, "location")
    legal_entity_id = _reference(LegalEntity, "legal_entity")
    manager_id = _reference(Employee, "manager")

    def validate_work_email(self, value):
        taken = User.objects.filter(email__iexact=value)
        if self.instance is not None:
            taken = taken.exclude(pk=self.instance.user_id)
        if taken.exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate_employee_code(self, value):
        taken = Employee.objects.filter(employee_code=value)
        if self.instance is not None:
            taken = taken.exclude(pk=self.instance.pk)
        if taken.exists():
            raise serializers.ValidationError("This employee code is already in use.")
        return value

    def validate(self, attrs):
        manager = attrs.get("manager")
        if manager is not None and self.instance is not None:
            self._reject_reporting_cycle(self.instance, manager)
        return attrs

    @staticmethod
    def _reject_reporting_cycle(employee, new_manager):
        """A manager change must not make someone (transitively) their own boss."""
        if new_manager.pk == employee.pk:
            raise serializers.ValidationError(
                {"manager_id": "An employee cannot be their own manager."}
            )
        seen, cursor = set(), new_manager
        while cursor is not None and cursor.pk not in seen:
            if cursor.pk == employee.pk:
                raise serializers.ValidationError(
                    {"manager_id": "This would create a circular reporting line."}
                )
            seen.add(cursor.pk)
            cursor = cursor.manager

    def create(self, validated):
        email = validated["work_email"]
        user = User(
            username=email,
            email=email,
            first_name=validated["first_name"],
            last_name=validated.get("last_name", ""),
            role=Role.objects.filter(name="Employee").first(),
        )
        user.set_unusable_password()
        status = validated.get("status", EmployeeStatus.ACTIVE)
        user.is_active = status != EmployeeStatus.EXITED
        user.save()
        return Employee.objects.create(
            user=user,
            employee_code=validated["employee_code"],
            status=status,
            department=validated.get("department"),
            designation=validated.get("designation"),
            location=validated.get("location"),
            legal_entity=validated.get("legal_entity"),
            manager=validated.get("manager"),
        )

    def update(self, employee, validated):
        user = employee.user
        for field in ("first_name", "last_name"):
            if field in validated:
                setattr(user, field, validated[field])
        if "work_email" in validated:
            if user.username == user.email:
                user.username = validated["work_email"]
            user.email = validated["work_email"]
        user.save()
        for field in (
            "employee_code",
            "status",
            "department",
            "designation",
            "location",
            "legal_entity",
            "manager",
        ):
            if field in validated:
                setattr(employee, field, validated[field])
        employee.save()
        return employee
