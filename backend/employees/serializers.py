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

from datetime import date

from django.contrib.auth import get_user_model
from rest_framework import serializers

from accounts.models import Role
from core.enums import EmployeeStatus, EmploymentType
from employees.models import (
    BusinessUnit,
    CostCenter,
    Department,
    Designation,
    Employee,
    LegalEntity,
    Location,
)

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


class BusinessUnitSerializer(_NamedEntitySerializer):
    class Meta(_NamedEntitySerializer.Meta):
        model = BusinessUnit


class CostCenterSerializer(_NamedEntitySerializer):
    class Meta(_NamedEntitySerializer.Meta):
        model = CostCenter
        fields = ["id", "name", "code"]


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
    legal_entity_id = serializers.SerializerMethodField()
    business_unit_id = serializers.SerializerMethodField()
    cost_center_id = serializers.SerializerMethodField()

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
            "legal_entity_id",
            "business_unit_id",
            "cost_center_id",
            "status",
            "employment_type",
            "date_of_joining",
            "date_of_exit",
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

    def get_legal_entity_id(self, obj):
        return str(obj.legal_entity_id) if obj.legal_entity_id else None

    def get_business_unit_id(self, obj):
        return str(obj.business_unit_id) if obj.business_unit_id else None

    def get_cost_center_id(self, obj):
        return str(obj.cost_center_id) if obj.cost_center_id else None


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
    business_unit_id = _reference(BusinessUnit, "business_unit")
    cost_center_id = _reference(CostCenter, "cost_center")
    employment_type = serializers.ChoiceField(choices=EmploymentType.choices, required=False)
    date_of_joining = serializers.DateField(required=False, allow_null=True)
    date_of_exit = serializers.DateField(required=False, allow_null=True)
    exit_reason = serializers.CharField(max_length=200, required=False, allow_blank=True)

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

        current = self.instance
        joined = (
            attrs["date_of_joining"]
            if "date_of_joining" in attrs
            else getattr(current, "date_of_joining", None)
        )
        left = (
            attrs["date_of_exit"]
            if "date_of_exit" in attrs
            else getattr(current, "date_of_exit", None)
        )
        status = attrs.get("status", getattr(current, "status", EmployeeStatus.ACTIVE))
        if joined and left and left < joined:
            raise serializers.ValidationError(
                {"date_of_exit": "The exit date cannot be before the joining date."}
            )
        if attrs.get("date_of_exit") and status != EmployeeStatus.EXITED:
            raise serializers.ValidationError(
                {"date_of_exit": "An exit date only applies to someone who has left."}
            )
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
        exit_date = validated.get("date_of_exit")
        if status == EmployeeStatus.EXITED and exit_date is None:
            exit_date = date.today()
        return Employee.objects.create(
            user=user,
            employee_code=validated["employee_code"],
            status=status,
            employment_type=validated.get("employment_type", EmploymentType.FULL_TIME),
            department=validated.get("department"),
            designation=validated.get("designation"),
            location=validated.get("location"),
            legal_entity=validated.get("legal_entity"),
            business_unit=validated.get("business_unit"),
            cost_center=validated.get("cost_center"),
            manager=validated.get("manager"),
            date_of_joining=validated.get("date_of_joining"),
            date_of_exit=exit_date,
            exit_reason=validated.get("exit_reason", ""),
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
            "business_unit",
            "cost_center",
            "manager",
            "employment_type",
            "date_of_joining",
            "date_of_exit",
            "exit_reason",
        ):
            if field in validated:
                setattr(employee, field, validated[field])
        employee.save()
        return employee


GENDER_CHOICES = [
    ("female", "Female"),
    ("male", "Male"),
    ("other", "Other"),
    ("prefer_not_to_say", "Prefer not to say"),
]


class PersonalSerializer(serializers.ModelSerializer):
    """Personal details, held back from the ordinary directory. Read with
    employees.personal.read, changed with employees.personal.write."""

    gender = serializers.ChoiceField(choices=GENDER_CHOICES, required=False, allow_blank=True)

    class Meta:
        model = Employee
        fields = ["personal_email", "phone", "dob", "gender", "exit_reason"]
        extra_kwargs = {
            "personal_email": {"required": False},
            "phone": {"required": False},
            "dob": {"required": False, "allow_null": True},
            "exit_reason": {"required": False},
        }

    def validate_dob(self, value):
        if value and value > date.today():
            raise serializers.ValidationError("Date of birth cannot be in the future.")
        return value


class EssProfileSerializer(serializers.ModelSerializer):
    """A person's own profile, in the shape the frontend's profile and
    organisation pages read (snake_case, string ids)."""

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
            "personal_email",
            "phone",
            "dob",
            "gender",
            "department_id",
            "designation_id",
            "location_id",
            "date_of_joining",
            "status",
            "manager_id",
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


class EssProfileWriteSerializer(PersonalSerializer):
    """What a person may change about themselves: contact details, date of
    birth and gender. Nothing about their job, manager or status."""

    class Meta(PersonalSerializer.Meta):
        fields = ["personal_email", "phone", "dob", "gender"]


# ---- organisation structure management (camelCase, paginated, org.manage) ----


class _OrgUnitSerializer(serializers.ModelSerializer):
    employee_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        fields = ["id", "name", "is_active", "employee_count", "created_at"]
        read_only_fields = ["id", "employee_count", "created_at"]


def _org_serializer(model, extra_fields=(), extra_read_only=(), **declared):
    meta = type(
        "Meta",
        (_OrgUnitSerializer.Meta,),
        {
            "model": model,
            "fields": [*_OrgUnitSerializer.Meta.fields, *extra_fields],
            "read_only_fields": [*_OrgUnitSerializer.Meta.read_only_fields, *extra_read_only],
        },
    )
    name = f"{model.__name__}AdminSerializer"
    return type(name, (_OrgUnitSerializer,), {"Meta": meta, **declared})


class _DepartmentAdmin(_OrgUnitSerializer):
    parent_name = serializers.CharField(source="parent.name", read_only=True, default=None)
    child_count = serializers.IntegerField(read_only=True, default=0)

    class Meta(_OrgUnitSerializer.Meta):
        model = Department
        fields = [*_OrgUnitSerializer.Meta.fields, "parent", "parent_name", "child_count"]
        read_only_fields = [*_OrgUnitSerializer.Meta.read_only_fields, "parent_name", "child_count"]

    def validate(self, attrs):
        parent = attrs.get("parent")
        if parent is not None and self.instance is not None:
            if parent.pk == self.instance.pk:
                raise serializers.ValidationError(
                    {"parent": "A department cannot be under itself."}
                )
            cursor, seen = parent, set()
            while cursor is not None and cursor.pk not in seen:
                if cursor.pk == self.instance.pk:
                    raise serializers.ValidationError(
                        {"parent": "A department cannot sit under its own sub-department."}
                    )
                seen.add(cursor.pk)
                cursor = cursor.parent
        return attrs


DepartmentAdminSerializer = _DepartmentAdmin
DesignationAdminSerializer = _org_serializer(Designation)
LocationAdminSerializer = _org_serializer(Location)
LegalEntityAdminSerializer = _org_serializer(LegalEntity)
BusinessUnitAdminSerializer = _org_serializer(BusinessUnit)
CostCenterAdminSerializer = _org_serializer(CostCenter, extra_fields=["code"])
