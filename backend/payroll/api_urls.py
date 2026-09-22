from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views as v

setup_router = DefaultRouter()
setup_router.register(r"legal-entity-profiles", v.LegalEntityPayrollProfileViewSet)
setup_router.register(r"pay-schedules", v.PayScheduleViewSet)
setup_router.register(r"statutory-configs", v.StatutoryConfigViewSet)
setup_router.register(r"salary-components", v.SalaryComponentViewSet)
setup_router.register(r"salary-structures", v.SalaryStructureViewSet)
setup_router.register(r"salary-structure-components", v.SalaryStructureComponentViewSet)
setup_router.register(r"tax-filing-configs", v.TaxFilingConfigViewSet)
setup_router.register(r"pay-stub-templates", v.PayStubTemplateViewSet)
setup_router.register(r"pay-groups", v.PayGroupViewSet)

inputs_router = DefaultRouter()
inputs_router.register(r"payment-info", v.EmployeePaymentInfoViewSet)
inputs_router.register(r"compensation", v.EmployeeCompensationViewSet)
inputs_router.register(r"variable-pay", v.EmployeeVariablePayViewSet)
inputs_router.register(r"statutory-info", v.EmployeeStatutoryInfoViewSet)
inputs_router.register(r"deductions", v.EmployeeDeductionViewSet)
inputs_router.register(r"benefits", v.EmployeeBenefitViewSet)
inputs_router.register(r"overtime-adjustments", v.PayrollOvertimeAdjustmentViewSet)
inputs_router.register(r"payroll-status", v.EmployeePayrollStatusViewSet)

urlpatterns = [
    path("payroll/setup/", include(setup_router.urls)),
    path("payroll/inputs/", include(inputs_router.urls)),
]
