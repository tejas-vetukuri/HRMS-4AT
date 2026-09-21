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

from rest_framework import serializers

from employees.models import Department, Designation, Employee, LegalEntity, Location


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
