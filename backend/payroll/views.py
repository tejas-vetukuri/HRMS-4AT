"""Payroll views, plugged into the core.

Include a preview endpoint that calculates payroll for an employee temporarily
without persisting, for UI preview purposes.


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


# ======================== Payroll Calculation Engine ========================


class PayrollPeriodViewSet(_ConfigViewSet):
    queryset = m.PayrollPeriod.objects.all()
    serializer_class = s.PayrollPeriodSerializer


class PayrollRunViewSet(_ConfigViewSet):
    queryset = m.PayrollRun.objects.select_related("period", "created_by").all()
    serializer_class = s.PayrollRunSerializer

    def create(self, request, *args, **kwargs):
        """Trigger payroll calculation for a period."""
        from .calculation_engine import process_payroll_for_period

        period_id = request.data.get('period_id')
        employee_ids = request.data.get('employee_ids')  # Optional: specific employees

        try:
            period = m.PayrollPeriod.objects.get(id=period_id)
            run = process_payroll_for_period(period, employee_ids)
            serializer = self.get_serializer(run)
            return Response({"success": True, "data": serializer.data})
        except m.PayrollPeriod.DoesNotExist:
            return Response(
                {"success": False, "error": "Period not found"},
                status=404
            )
        except Exception as e:
            return Response(
                {"success": False, "error": str(e)},
                status=400
            )


class PayrollResultViewSet(_EmployeeScopedViewSet):
    queryset = m.PayrollResult.objects.select_related("run", "employee").all()
    serializer_class = s.PayrollResultSerializer


class PfRuleViewSet(_ConfigViewSet):
    queryset = m.PfRule.objects.select_related("legal_entity").all()
    serializer_class = s.PfRuleSerializer


class PtSlabViewSet(_ConfigViewSet):
    queryset = m.PtSlab.objects.select_related("legal_entity").all()
    serializer_class = s.PtSlabSerializer


class TdsConfigurationViewSet(_ConfigViewSet):
    queryset = m.TdsConfiguration.objects.select_related("legal_entity").all()
    serializer_class = s.TdsConfigurationSerializer


class LopConfigurationViewSet(_ConfigViewSet):
    queryset = m.LopConfiguration.objects.select_related("legal_entity").all()
    serializer_class = s.LopConfigurationSerializer


class PayrollAdjustmentViewSet(_EmployeeScopedViewSet):
    queryset = m.PayrollAdjustment.objects.select_related("employee").all()
    serializer_class = s.PayrollAdjustmentSerializer


# ======================== Payroll Preview Endpoint ========================

from rest_framework.decorators import api_view
from rest_framework.permissions import IsAuthenticated
from core.permissions import ScopedEmployeePermission
from core.api import FrontendEnvelopeMixin
from datetime import date
from decimal import Decimal


@api_view(['GET'])
def payroll_preview(request):
    """
    Preview payroll calculation for an employee.

    Query params:
    - employee_id: Employee ID
    - ctc: Monthly CTC amount

    Returns earnings, deductions, and net pay breakdown.
    """
    from .calculation_engine import PayrollCalculationEngine

    employee_id = request.query_params.get('employee_id')
    annual_ctc_str = request.query_params.get('ctc')  # Annual CTC

    if not employee_id or not annual_ctc_str:
        return Response(
            {"success": False, "error": "employee_id and ctc required"},
            status=400
        )

    try:
        employee = m.Employee.objects.get(id=employee_id)

        # Check permission
        from core.scope import resolve_employee_scope
        allowed_ids = resolve_employee_scope(request.user)
        if employee.id not in allowed_ids:
            return Response(
                {"success": False, "error": "Permission denied"},
                status=403
            )

        annual_ctc = Decimal(annual_ctc_str)
        monthly_ctc = annual_ctc / 12

        # Auto-match salary structure based on CTC range
        structure = m.SalaryStructure.objects.filter(
            legal_entity=employee.legal_entity,
            min_salary__lte=annual_ctc,
            max_salary__gte=annual_ctc
        ).first()

        if not structure:
            return Response(
                {"success": False, "error": f"No salary structure matches CTC ₹{annual_ctc:,.0f}. Valid ranges: Stipend (15K-20K), 3L-5L, 6L-9L, 10L-13L, 14L-17L, 25L+"},
                status=400
            )

        # Get or create current payroll period
        today = date.today()
        period, _ = m.PayrollPeriod.objects.get_or_create(
            legal_entity=employee.legal_entity,
            year=today.year,
            month=today.month,
            defaults={
                'start_date': date(today.year, today.month, 1),
                'end_date': date(today.year, today.month, 28),  # Simplified
                'working_days': 22,
            }
        )

        # Temporarily set employee CTC and structure for calculation
        comp = m.EmployeeCompensation.objects.filter(employee=employee).first()
        if not comp:
            return Response(
                {"success": False, "error": "No compensation record found"},
                status=400
            )

        old_ctc = comp.fixed_monthly_amount
        old_structure = comp.salary_structure
        comp.fixed_monthly_amount = monthly_ctc
        comp.salary_structure = structure

        # Calculate
        engine = PayrollCalculationEngine(employee, period)
        result = engine.calculate()

        # Restore old values
        comp.fixed_monthly_amount = old_ctc
        comp.salary_structure = old_structure

        if 'error' in result:
            return Response(
                {"success": False, "error": result['error']},
                status=400
            )

        return Response({
            "success": True,
            "data": {
                'structure_name': structure.name,
                'earnings': result.get('earnings', {}),
                'deductions': result.get('deductions', {}),
                'totals': result.get('totals', {}),
            }
        })

    except m.Employee.DoesNotExist:
        return Response(
            {"success": False, "error": "Employee not found"},
            status=404
        )
    except Exception as e:
        return Response(
            {"success": False, "error": str(e)},
            status=500
        )
