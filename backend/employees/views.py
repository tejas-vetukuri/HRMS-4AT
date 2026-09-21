from rest_framework import filters, viewsets
from rest_framework.parsers import JSONParser
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response

from core.permissions import HasPermissionCode, ScopedEmployeePermission
from core.scope import resolve_employee_scope
from employees.models import Department, Designation, Employee, LegalEntity, Location
from employees.serializers import (
    DepartmentSerializer,
    DesignationSerializer,
    EmployeeSerializer,
    LegalEntitySerializer,
    LocationSerializer,
)


class FrontendEnvelopeMixin:
    """employees/page.tsx, org/page.tsx, and profile/page.tsx's `fetchJson()`
    reads every response as `{success: bool, data: T}` — verified against
    that source, not assumed from docs — and expects `data` to be a bare
    array for a list, not `{results, total, page, pageSize}` (that shape
    doesn't appear anywhere in the actual frontend). Plain JSONRenderer here
    means these specific endpoints skip the project's general camelCase
    conversion too, since the frontend interfaces these pages use are
    snake_case. Both are deliberate, isolated exceptions scoped to exactly
    the viewsets these three pages call — everywhere else (auth, RBAC) keeps
    the camelCase + paginated convention, which those callers genuinely use."""

    pagination_class = None
    renderer_classes = [JSONRenderer]
    parser_classes = [JSONParser]

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return Response({"success": True, "data": serializer.data})

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response({"success": True, "data": serializer.data})


class EmployeeViewSet(FrontendEnvelopeMixin, viewsets.ReadOnlyModelViewSet):
    """The employee directory. `list` is filtered through
    resolve_employee_scope() so each caller only ever sees who their
    `employees.read` scope actually covers; `retrieve` on an out-of-scope
    employee is an explicit 403 via ScopedEmployeePermission.has_object_permission,
    not a queryset-filtered 404 — see docs/TASKS.md P1-SH-01 for why that
    distinction matters."""

    serializer_class = EmployeeSerializer
    permission_classes = [ScopedEmployeePermission]
    required_permission = "employees.read"
    filter_backends = [filters.SearchFilter]
    search_fields = ["employee_code", "user__first_name", "user__last_name", "user__email"]

    def get_queryset(self):
        base = Employee.objects.select_related(
            "user", "manager__user", "department", "designation", "location", "legal_entity"
        )
        if self.action == "list":
            scoped_ids = resolve_employee_scope(self.request.user, self.required_permission)
            return base.filter(pk__in=scoped_ids)
        return base


class _EmployeeReadOnlyReferenceViewSet(FrontendEnvelopeMixin, viewsets.ReadOnlyModelViewSet):
    """Shared shape for the small org-dimension reference lists below — not
    employee-keyed, so anyone who can read the directory can read these (they're
    what the directory's department/location/etc. filters populate)."""

    permission_classes = [HasPermissionCode]
    required_permission = "employees.read"


class DepartmentViewSet(_EmployeeReadOnlyReferenceViewSet):
    queryset = Department.objects.filter(is_active=True)
    serializer_class = DepartmentSerializer


class DesignationViewSet(_EmployeeReadOnlyReferenceViewSet):
    queryset = Designation.objects.filter(is_active=True)
    serializer_class = DesignationSerializer


class LocationViewSet(_EmployeeReadOnlyReferenceViewSet):
    queryset = Location.objects.filter(is_active=True)
    serializer_class = LocationSerializer


class LegalEntityViewSet(_EmployeeReadOnlyReferenceViewSet):
    queryset = LegalEntity.objects.filter(is_active=True)
    serializer_class = LegalEntitySerializer
