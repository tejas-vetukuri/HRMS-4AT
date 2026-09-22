from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    LegalEntityViewSet,
    PayScheduleViewSet,
    StatutoryConfigViewSet,
    SalaryComponentViewSet,
    SalaryStructureViewSet,
    SalaryStructureComponentViewSet,
    TaxFilingConfigViewSet,
    PayStubTemplateViewSet,
    PayGroupViewSet,
    EmployeePaymentInfoViewSet,
    EmployeeCompensationViewSet,
    EmployeeVariablePayViewSet,
    EmployeeStatutoryInfoViewSet,
    EmployeeDeductionViewSet,
    EmployeeBenefitViewSet,
    PayrollOvertimeAdjustmentViewSet,
    EmployeePayrollStatusViewSet,
)

setup_router = DefaultRouter()
setup_router.register(r'legal-entities', LegalEntityViewSet)
setup_router.register(r'pay-schedules', PayScheduleViewSet)
setup_router.register(r'statutory-configs', StatutoryConfigViewSet)
setup_router.register(r'salary-components', SalaryComponentViewSet)
setup_router.register(r'salary-structures', SalaryStructureViewSet)
setup_router.register(r'salary-structure-components', SalaryStructureComponentViewSet)
setup_router.register(r'tax-filing-configs', TaxFilingConfigViewSet)
setup_router.register(r'pay-stub-templates', PayStubTemplateViewSet)
setup_router.register(r'pay-groups', PayGroupViewSet)

inputs_router = DefaultRouter()
inputs_router.register(r'payment-info', EmployeePaymentInfoViewSet)
inputs_router.register(r'compensation', EmployeeCompensationViewSet)
inputs_router.register(r'variable-pay', EmployeeVariablePayViewSet)
inputs_router.register(r'statutory-info', EmployeeStatutoryInfoViewSet)
inputs_router.register(r'deductions', EmployeeDeductionViewSet)
inputs_router.register(r'benefits', EmployeeBenefitViewSet)
inputs_router.register(r'overtime-adjustments', PayrollOvertimeAdjustmentViewSet)
inputs_router.register(r'payroll-status', EmployeePayrollStatusViewSet)

app_name = 'payroll'

urlpatterns = [
    path('setup/', include(setup_router.urls)),
    path('inputs/', include(inputs_router.urls)),
]
