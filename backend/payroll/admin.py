from django.contrib import admin
from .models import (
    LegalEntity,
    PaySchedule,
    StatutoryConfig,
    SalaryComponent,
    SalaryStructure,
    SalaryStructureComponent,
    TaxFilingConfig,
    PayStubTemplate,
    PayGroup,
    EmployeePaymentInfo,
    EmployeeCompensation,
    EmployeeVariablePay,
    EmployeeStatutoryInfo,
    EmployeeDeduction,
    EmployeeBenefit,
    PayrollOvertimeAdjustment,
    EmployeePayrollStatus,
)


@admin.register(LegalEntity)
class LegalEntityAdmin(admin.ModelAdmin):
    list_display = ('name', 'pan', 'state', 'is_active')
    search_fields = ('name', 'pan')
    list_filter = ('is_active', 'state')


@admin.register(PaySchedule)
class PayScheduleAdmin(admin.ModelAdmin):
    list_display = ('name', 'frequency', 'cutoff_day', 'is_active')
    search_fields = ('name',)
    list_filter = ('frequency', 'is_active')


@admin.register(StatutoryConfig)
class StatutoryConfigAdmin(admin.ModelAdmin):
    list_display = ('legal_entity', 'contribution_type', 'is_enabled')
    search_fields = ('legal_entity__name', 'registration_number')
    list_filter = ('contribution_type', 'is_enabled')


@admin.register(SalaryComponent)
class SalaryComponentAdmin(admin.ModelAdmin):
    list_display = ('name', 'component_type', 'calculation_type', 'is_active')
    search_fields = ('name',)
    list_filter = ('component_type', 'calculation_type', 'is_active', 'is_statutory')


@admin.register(SalaryStructure)
class SalaryStructureAdmin(admin.ModelAdmin):
    list_display = ('name', 'legal_entity', 'min_salary', 'max_salary', 'is_active')
    search_fields = ('name', 'legal_entity__name')
    list_filter = ('is_active', 'legal_entity')


class SalaryStructureComponentInline(admin.TabularInline):
    model = SalaryStructureComponent
    extra = 0


@admin.register(SalaryStructureComponent)
class SalaryStructureComponentAdmin(admin.ModelAdmin):
    list_display = ('structure', 'component', 'order')
    search_fields = ('structure__name', 'component__name')
    list_filter = ('structure',)


@admin.register(TaxFilingConfig)
class TaxFilingConfigAdmin(admin.ModelAdmin):
    list_display = ('legal_entity', 'filing_frequency')
    search_fields = ('legal_entity__name',)
    list_filter = ('filing_frequency',)


@admin.register(PayStubTemplate)
class PayStubTemplateAdmin(admin.ModelAdmin):
    list_display = ('name', 'applies_to', 'delivery_method', 'is_default')
    search_fields = ('name',)
    list_filter = ('applies_to', 'is_default', 'delivery_method')


@admin.register(PayGroup)
class PayGroupAdmin(admin.ModelAdmin):
    list_display = ('name', 'legal_entity', 'pay_schedule', 'maker_checker_enabled')
    search_fields = ('name', 'legal_entity__name')
    list_filter = ('legal_entity', 'maker_checker_enabled')


# ======================== Payroll Inputs Admin ========================


@admin.register(EmployeePaymentInfo)
class EmployeePaymentInfoAdmin(admin.ModelAdmin):
    list_display = ('employee_id', 'payment_method')
    search_fields = ('employee_id',)
    list_filter = ('payment_method',)


@admin.register(EmployeeCompensation)
class EmployeeCompensationAdmin(admin.ModelAdmin):
    list_display = ('employee_id', 'fixed_monthly_amount', 'is_contractor', 'effective_from')
    search_fields = ('employee_id',)
    list_filter = ('is_contractor',)


@admin.register(EmployeeVariablePay)
class EmployeeVariablePayAdmin(admin.ModelAdmin):
    list_display = ('compensation', 'component', 'amount', 'pay_month')
    search_fields = ('compensation__employee_id', 'component__name')
    list_filter = ('pay_month',)


@admin.register(EmployeeStatutoryInfo)
class EmployeeStatutoryInfoAdmin(admin.ModelAdmin):
    list_display = ('employee_id', 'pan_number', 'lwf_applicable')
    search_fields = ('employee_id', 'pan_number')
    list_filter = ('lwf_applicable', 'professional_tax_exempt')


@admin.register(EmployeeDeduction)
class EmployeeDeductionAdmin(admin.ModelAdmin):
    list_display = ('employee_id', 'deduction_type', 'name', 'is_active')
    search_fields = ('employee_id', 'name')
    list_filter = ('deduction_type', 'is_active')


@admin.register(EmployeeBenefit)
class EmployeeBenefitAdmin(admin.ModelAdmin):
    list_display = ('employee_id', 'benefit_type', 'name', 'is_active')
    search_fields = ('employee_id', 'name')
    list_filter = ('benefit_type', 'is_active')


@admin.register(PayrollOvertimeAdjustment)
class PayrollOvertimeAdjustmentAdmin(admin.ModelAdmin):
    list_display = ('employee_id', 'pay_period_month', 'overtime_hours')
    search_fields = ('employee_id',)
    list_filter = ('pay_period_month',)


@admin.register(EmployeePayrollStatus)
class EmployeePayrollStatusAdmin(admin.ModelAdmin):
    list_display = ('employee_id', 'is_payroll_enabled', 'effective_from')
    search_fields = ('employee_id',)
    list_filter = ('is_payroll_enabled',)
