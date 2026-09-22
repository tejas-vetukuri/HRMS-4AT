"""Payroll views, plugged into the core.

Two kinds of endpoint:
- Configuration (schedules, components, structures, entities, …): org-level, not
  employee-keyed. Gated by a flat `payroll.manage` capability (HasPermissionCode).
- Employee-owned records (compensation, deductions, …): scoped through the row's
  `employee` FK via ScopedEmployeePermission + resolve_employee_scope, so an
  Employee sees only their own, a Manager their team, HR/Finance everyone.
"""

from rest_framework import viewsets
from rest_framework.pagination import PageNumberPagination

from core.permissions import HasPermissionCode, ScopedEmployeePermission
from core.scope import resolve_employee_scope

from . import models as m
from . import serializers as s


class StandardPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


# ----------------------- configuration (payroll.manage) -----------------------


class _ConfigViewSet(viewsets.ModelViewSet):
    permission_classes = [HasPermissionCode]
    required_permission = "payroll.manage"
    pagination_class = StandardPagination


class LegalEntityPayrollProfileViewSet(_ConfigViewSet):
    queryset = m.LegalEntityPayrollProfile.objects.all()
    serializer_class = s.LegalEntityPayrollProfileSerializer


class PayScheduleViewSet(_ConfigViewSet):
    queryset = m.PaySchedule.objects.all()
    serializer_class = s.PayScheduleSerializer


class StatutoryConfigViewSet(_ConfigViewSet):
    queryset = m.StatutoryConfig.objects.all()
    serializer_class = s.StatutoryConfigSerializer


class SalaryComponentViewSet(_ConfigViewSet):
    queryset = m.SalaryComponent.objects.all()
    serializer_class = s.SalaryComponentSerializer


class SalaryStructureViewSet(_ConfigViewSet):
    queryset = m.SalaryStructure.objects.all()
    serializer_class = s.SalaryStructureSerializer


class SalaryStructureComponentViewSet(_ConfigViewSet):
    queryset = m.SalaryStructureComponent.objects.all()
    serializer_class = s.SalaryStructureComponentSerializer


class TaxFilingConfigViewSet(_ConfigViewSet):
    queryset = m.TaxFilingConfig.objects.all()
    serializer_class = s.TaxFilingConfigSerializer


class PayStubTemplateViewSet(_ConfigViewSet):
    queryset = m.PayStubTemplate.objects.all()
    serializer_class = s.PayStubTemplateSerializer


class PayGroupViewSet(_ConfigViewSet):
    queryset = m.PayGroup.objects.all()
    serializer_class = s.PayGroupSerializer


# ----------------- employee-owned records (payroll.read/write) ----------------


class _EmployeeScopedViewSet(viewsets.ModelViewSet):
    permission_classes = [ScopedEmployeePermission]
    required_permission = "payroll.read"
    write_permission = "payroll.write"
    pagination_class = StandardPagination
    scope_field = "employee_id"  # the FK column each list filters on

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action == "list":
            scope = resolve_employee_scope(self.request.user, self.required_permission)
            return queryset.filter(**{f"{self.scope_field}__in": scope})
        return queryset


class EmployeePaymentInfoViewSet(_EmployeeScopedViewSet):
    queryset = m.EmployeePaymentInfo.objects.select_related("employee").all()
    serializer_class = s.EmployeePaymentInfoSerializer


class EmployeeCompensationViewSet(_EmployeeScopedViewSet):
    queryset = m.EmployeeCompensation.objects.select_related("employee").all()
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
