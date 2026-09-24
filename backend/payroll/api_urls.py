"""Payroll API routes (auto-included by config.api_urls)."""

from django.urls import path
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()

# Add preview endpoint
custom_patterns = [
    path('payroll/preview/', views.payroll_preview, name='payroll_preview'),
]

# Configuration endpoints (payroll.manage)
router.register("payroll/setup/legal-entities", views.LegalEntityViewSet, basename="payroll_legal_entity")
router.register("payroll/setup/pay-schedules", views.PayScheduleViewSet, basename="payroll_pay_schedule")
router.register("payroll/setup/salary-components", views.SalaryComponentViewSet, basename="payroll_salary_component")
router.register("payroll/setup/salary-structures", views.SalaryStructureViewSet, basename="payroll_salary_structure")
router.register("payroll/setup/pay-groups", views.PayGroupViewSet, basename="payroll_pay_group")
router.register("payroll/setup/statutory-configs", views.StatutoryConfigViewSet, basename="payroll_statutory_config")
router.register("payroll/setup/tax-filing-configs", views.TaxFilingConfigViewSet, basename="payroll_tax_filing_config")
router.register("payroll/setup/paystub-templates", views.PayStubTemplateViewSet, basename="payroll_paystub_template")

# Payroll Calculation Configuration (payroll.manage)
router.register("payroll/config/pf-rules", views.PfRuleViewSet, basename="payroll_pf_rule")
router.register("payroll/config/pt-slabs", views.PtSlabViewSet, basename="payroll_pt_slab")
router.register("payroll/config/tds-config", views.TdsConfigurationViewSet, basename="payroll_tds_config")
router.register("payroll/config/lop-config", views.LopConfigurationViewSet, basename="payroll_lop_config")

# Payroll Periods & Runs (payroll.manage)
router.register("payroll/periods", views.PayrollPeriodViewSet, basename="payroll_period")
router.register("payroll/runs", views.PayrollRunViewSet, basename="payroll_run")

# Employee-scoped endpoints (payroll.read / payroll.write)
router.register("payroll/inputs/payment-info", views.EmployeePaymentInfoViewSet, basename="payroll_payment_info")
router.register("payroll/inputs/compensation", views.EmployeeCompensationViewSet, basename="payroll_compensation")
router.register("payroll/inputs/variable-pay", views.EmployeeVariablePayViewSet, basename="payroll_variable_pay")
router.register("payroll/inputs/statutory-info", views.EmployeeStatutoryInfoViewSet, basename="payroll_statutory_info")
router.register("payroll/inputs/deductions", views.EmployeeDeductionViewSet, basename="payroll_deduction")
router.register("payroll/inputs/benefits", views.EmployeeBenefitViewSet, basename="payroll_benefit")
router.register("payroll/inputs/overtime-adjustments", views.PayrollOvertimeAdjustmentViewSet, basename="payroll_overtime_adjustment")
router.register("payroll/inputs/payroll-status", views.EmployeePayrollStatusViewSet, basename="payroll_payroll_status")
router.register("payroll/inputs/adjustments", views.PayrollAdjustmentViewSet, basename="payroll_adjustment")

# Payroll Results (read-only for employees, full access for finance/hr)
router.register("payroll/results", views.PayrollResultViewSet, basename="payroll_result")

urlpatterns = custom_patterns + router.urls
