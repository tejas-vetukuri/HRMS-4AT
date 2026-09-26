"""Payroll views, plugged into the core.

Two kinds of endpoint:
- Configuration (schedules, components, structures, entities, …): org-level, not
  employee-keyed. Gated by a flat `payroll.manage` capability (HasPermissionCode).
- Employee-owned records (compensation, deductions, …): scoped through the row's
  `employee` FK via ScopedEmployeePermission + resolve_employee_scope, so an
  Employee sees only their own, a Manager their team, HR/Finance everyone.

Both return the `{success, data}` envelope the frontend's payroll pages read
(via core.api.FrontendEnvelopeMixin: snake_case, unpaginated). The setup pages
read `data.results`; the inputs pages read `data` as a bare array — matched below.
"""

from rest_framework import serializers, viewsets
from rest_framework.response import Response

from core.api import FrontendEnvelopeMixin
from core.permissions import HasPermissionCode, ScopedEmployeePermission
from core.scope import resolve_employee_scope
from employees.models import LegalEntity

from . import models as m
from . import serializers as s

# --------------------------- configuration (payroll.manage) -------------------


class _ConfigEnvelopeMixin(FrontendEnvelopeMixin):
    """Setup pages read `body.data.results`, so wrap the list in {results, total}."""

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        data = self.get_serializer(queryset, many=True).data
        return Response({"success": True, "data": {"results": data, "total": len(data)}})


class _ConfigViewSet(_ConfigEnvelopeMixin, viewsets.ModelViewSet):
    permission_classes = [HasPermissionCode]
    required_permission = "payroll.manage"


class LegalEntitySerializer(serializers.ModelSerializer):
    class Meta:
        model = LegalEntity
        fields = ("id", "name")


class LegalEntityViewSet(_ConfigEnvelopeMixin, viewsets.ReadOnlyModelViewSet):
    """Read-only list of the core's legal entities, so payroll setup screens can
    show entity names. Any payroll user may read it."""

    permission_classes = [HasPermissionCode]
    required_permission = "payroll.read"
    queryset = LegalEntity.objects.all()
    serializer_class = LegalEntitySerializer


class LegalEntityPayrollProfileViewSet(_ConfigViewSet):
    queryset = m.LegalEntityPayrollProfile.objects.all()
    serializer_class = s.LegalEntityPayrollProfileSerializer


class PayScheduleViewSet(_ConfigViewSet):
    queryset = m.PaySchedule.objects.all()
    serializer_class = s.PayScheduleSerializer


class StatutoryConfigViewSet(_ConfigViewSet):
    queryset = m.StatutoryConfig.objects.select_related("legal_entity").all()
    serializer_class = s.StatutoryConfigSerializer


class SalaryComponentViewSet(_ConfigViewSet):
    queryset = m.SalaryComponent.objects.all()
    serializer_class = s.SalaryComponentSerializer


class SalaryStructureViewSet(_ConfigViewSet):
    queryset = m.SalaryStructure.objects.select_related("legal_entity").all()
    serializer_class = s.SalaryStructureSerializer


class SalaryStructureComponentViewSet(_ConfigViewSet):
    queryset = m.SalaryStructureComponent.objects.all()
    serializer_class = s.SalaryStructureComponentSerializer


class TaxFilingConfigViewSet(_ConfigViewSet):
    queryset = m.TaxFilingConfig.objects.select_related("legal_entity").all()
    serializer_class = s.TaxFilingConfigSerializer


class PayStubTemplateViewSet(_ConfigViewSet):
    queryset = m.PayStubTemplate.objects.all()
    serializer_class = s.PayStubTemplateSerializer


class PayGroupViewSet(_ConfigViewSet):
    queryset = m.PayGroup.objects.select_related("legal_entity", "pay_schedule").all()
    serializer_class = s.PayGroupSerializer


# ----------------- employee-owned records (payroll.read/write) ----------------


class _EmployeeScopedViewSet(FrontendEnvelopeMixin, viewsets.ModelViewSet):
    permission_classes = [ScopedEmployeePermission]
    required_permission = "payroll.read"
    write_permission = "payroll.write"
    scope_field = "employee_id"  # the FK column each list filters on

    def get_queryset(self):
        queryset = super().get_queryset()
        # Scope + the optional ?employee_id= picker filter apply to the list only;
        # object-level access on detail is enforced by ScopedEmployeePermission
        # (so an out-of-scope detail is a 403, not a silent 404).
        if self.action == "list":
            scope = resolve_employee_scope(self.request.user, self.required_permission)
            queryset = queryset.filter(**{f"{self.scope_field}__in": scope})
            employee_id = self.request.query_params.get("employee_id")
            if employee_id:
                queryset = queryset.filter(**{self.scope_field: employee_id})
        return queryset


class EmployeePaymentInfoViewSet(_EmployeeScopedViewSet):
    queryset = m.EmployeePaymentInfo.objects.select_related("employee").all()
    serializer_class = s.EmployeePaymentInfoSerializer


class EmployeeCompensationViewSet(_EmployeeScopedViewSet):
    queryset = m.EmployeeCompensation.objects.select_related("employee", "salary_structure").all()
    serializer_class = s.EmployeeCompensationSerializer


class EmployeeVariablePayViewSet(_EmployeeScopedViewSet):
    queryset = m.EmployeeVariablePay.objects.select_related("compensation").all()
    serializer_class = s.EmployeeVariablePaySerializer
    scope_field = "compensation__employee_id"


class EmployeeStatutoryInfoViewSet(_EmployeeScopedViewSet):
    queryset = m.EmployeeStatutoryInfo.objects.select_related("employee").all()
    serializer_class = s.EmployeeStatutoryInfoSerializer


class EmployeeDeductionViewSet(_EmployeeScopedViewSet):
    queryset = m.EmployeeDeduction.objects.select_related("employee").all()
    serializer_class = s.EmployeeDeductionSerializer


class EmployeeBenefitViewSet(_EmployeeScopedViewSet):
    queryset = m.EmployeeBenefit.objects.select_related("employee").all()
    serializer_class = s.EmployeeBenefitSerializer


class PayrollOvertimeAdjustmentViewSet(_EmployeeScopedViewSet):
    queryset = m.PayrollOvertimeAdjustment.objects.select_related("employee").all()
    serializer_class = s.PayrollOvertimeAdjustmentSerializer


class EmployeePayrollStatusViewSet(_EmployeeScopedViewSet):
    queryset = m.EmployeePayrollStatus.objects.select_related("employee").all()
    serializer_class = s.EmployeePayrollStatusSerializer
