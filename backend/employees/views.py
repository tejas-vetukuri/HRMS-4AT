from django.db import transaction
from rest_framework import filters, mixins, status, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from accounts.services import revoke_all_sessions
from audit.service import write_audit
from core.api import FrontendEnvelopeMixin
from core.enums import EmployeeStatus
from core.permissions import HasPermissionCode, ScopedEmployeePermission
from core.scope import resolve_employee_scope
from employees.models import Department, Designation, Employee, LegalEntity, Location
from employees.serializers import (
    DepartmentSerializer,
    DesignationSerializer,
    EmployeeSerializer,
    EmployeeWriteSerializer,
    LegalEntitySerializer,
    LocationSerializer,
)


class EmployeeViewSet(
    FrontendEnvelopeMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.ReadOnlyModelViewSet,
):
    """The employee directory.

    Reading: `list` is filtered through resolve_employee_scope() so each caller
    only sees who their `employees.read` scope covers; `retrieve` on an
    out-of-scope employee is an explicit 403 (ScopedEmployeePermission), not a
    filtered-away 404 (docs/TASKS.md P1-SH-01).

    Writing (`employees.write`, scoped the same way): create and PATCH only, no
    PUT and no DELETE. Someone leaving is a status change to `exited`, which
    also ends their access. A write may never move a person, or point a
    manager, outside the caller's own write scope."""

    serializer_class = EmployeeSerializer
    permission_classes = [ScopedEmployeePermission]
    required_permission = "employees.read"
    write_permission = "employees.write"
    http_method_names = ["get", "post", "patch", "head", "options"]
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

    def get_serializer_class(self):
        if self.action in ("create", "partial_update"):
            return EmployeeWriteSerializer
        return super().get_serializer_class()

    # -- writes -------------------------------------------------------------

    def _write_scope(self):
        return resolve_employee_scope(self.request.user, self.write_permission)

    def _require_in_write_scope(self, employee, message):
        if not self._write_scope().filter(pk=employee.pk).exists():
            raise PermissionDenied(message)

    def _require_manager_in_write_scope(self, serializer):
        manager = serializer.validated_data.get("manager")
        if manager is not None:
            self._require_in_write_scope(
                manager, "The chosen manager is outside the records you may edit."
            )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            self._require_manager_in_write_scope(serializer)
            employee = serializer.save()
            # The new record must fall inside the caller's own write scope, or a
            # narrow editor could create people they can never see again.
            self._require_in_write_scope(
                employee, "You may not create employees outside your own scope."
            )
            write_audit(
                request.user,
                "Employee.created",
                "Employee",
                employee.pk,
                {"after": EmployeeSerializer(employee).data},
            )
        return Response(
            {"success": True, "data": EmployeeSerializer(employee).data},
            status=status.HTTP_201_CREATED,
        )

    def partial_update(self, request, *args, **kwargs):
        employee = self.get_object()  # scope-checked against employees.write
        before = EmployeeSerializer(employee).data
        old_status = employee.status
        serializer = self.get_serializer(employee, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            self._require_manager_in_write_scope(serializer)
            employee = serializer.save()
            self._require_in_write_scope(
                employee, "You may not move an employee outside your own scope."
            )
            self._apply_status_change(request.user, employee, old_status)
            write_audit(
                request.user,
                "Employee.updated",
                "Employee",
                employee.pk,
                {"before": before, "after": EmployeeSerializer(employee).data},
            )
        return Response({"success": True, "data": EmployeeSerializer(employee).data})

    def _apply_status_change(self, actor, employee, old_status):
        """Status is the source of truth for whether someone can sign in: exiting
        ends their access at once; reactivating restores it."""
        exited = EmployeeStatus.EXITED
        user = employee.user
        if employee.status == exited and old_status != exited:
            user.is_active = False
            user.save(update_fields=["is_active"])
            revoked = revoke_all_sessions(user)
            write_audit(
                actor, "Employee.exited", "Employee", employee.pk, {"sessionsRevoked": revoked}
            )
        elif old_status == exited and employee.status != exited:
            user.is_active = True
            user.save(update_fields=["is_active"])
            write_audit(actor, "Employee.reactivated", "Employee", employee.pk)


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
