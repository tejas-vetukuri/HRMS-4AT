from rest_framework import serializers
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


class LegalEntitySerializer(serializers.ModelSerializer):
    class Meta:
        model = LegalEntity
        fields = [
            'id', 'name', 'pan', 'tan', 'gstin', 'state', 'address', 'is_active',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class PayScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaySchedule
        fields = [
            'id', 'name', 'frequency', 'pay_period_start_day', 'cutoff_day',
            'pay_date_offset_days', 'first_cycle_start_date', 'is_active',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class StatutoryConfigSerializer(serializers.ModelSerializer):
    legal_entity_name = serializers.CharField(source='legal_entity.name', read_only=True)

    class Meta:
        model = StatutoryConfig
        fields = [
            'id', 'legal_entity', 'legal_entity_name', 'contribution_type', 'is_enabled',
            'registration_number', 'effective_date', 'signatory_name', 'signatory_designation',
            'signatory_pan', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class SalaryComponentSerializer(serializers.ModelSerializer):
    class Meta:
        model = SalaryComponent
        fields = [
            'id', 'name', 'component_type', 'calculation_type', 'formula_expr',
            'default_value', 'is_taxable', 'is_statutory', 'is_active',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class SalaryStructureComponentSerializer(serializers.ModelSerializer):
    component_name = serializers.CharField(source='component.name', read_only=True)
    component_type = serializers.CharField(source='component.component_type', read_only=True)

    class Meta:
        model = SalaryStructureComponent
        fields = [
            'id', 'structure', 'component', 'component_name', 'component_type',
            'order', 'value_override', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class SalaryStructureSerializer(serializers.ModelSerializer):
    components = SalaryStructureComponentSerializer(many=True, read_only=True)
    legal_entity_name = serializers.CharField(source='legal_entity.name', read_only=True)

    class Meta:
        model = SalaryStructure
        fields = [
            'id', 'name', 'min_salary', 'max_salary', 'legal_entity', 'legal_entity_name',
            'is_active', 'components', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'components']


class TaxFilingConfigSerializer(serializers.ModelSerializer):
    legal_entity_name = serializers.CharField(source='legal_entity.name', read_only=True)

    class Meta:
        model = TaxFilingConfig
        fields = [
            'id', 'legal_entity', 'legal_entity_name', 'filing_frequency',
            'state_tax_id', 'federal_tax_id', 'effective_from',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class PayStubTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayStubTemplate
        fields = [
            'id', 'name', 'applies_to', 'logo_document_id', 'layout_json',
            'delivery_method', 'is_default', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class PayGroupSerializer(serializers.ModelSerializer):
    legal_entity_name = serializers.CharField(source='legal_entity.name', read_only=True)
    pay_schedule_name = serializers.CharField(source='pay_schedule.name', read_only=True)
    default_salary_structure_name = serializers.CharField(
        source='default_salary_structure.name', read_only=True
    )

    class Meta:
        model = PayGroup
        fields = [
            'id', 'name', 'legal_entity', 'legal_entity_name', 'pay_schedule',
            'pay_schedule_name', 'default_salary_structure', 'default_salary_structure_name',
            'approver_id', 'maker_checker_enabled', 'approval_threshold_amount',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class EmployeePaymentInfoSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeePaymentInfo
        fields = [
            'id', 'employee_id', 'payment_method', 'bank_name', 'bank_account_number',
            'bank_ifsc_code', 'bank_account_holder_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class EmployeeVariablePaySerializer(serializers.ModelSerializer):
    component_name = serializers.CharField(source='component.name', read_only=True)

    class Meta:
        model = EmployeeVariablePay
        fields = [
            'id', 'compensation', 'component', 'component_name', 'amount', 'pay_month',
            'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class EmployeeCompensationSerializer(serializers.ModelSerializer):
    variable_pays = EmployeeVariablePaySerializer(many=True, read_only=True)
    salary_structure_name = serializers.CharField(source='salary_structure.name', read_only=True)

    class Meta:
        model = EmployeeCompensation
        fields = [
            'id', 'employee_id', 'salary_structure', 'salary_structure_name', 'fixed_monthly_amount',
            'is_contractor', 'contractor_rate_type', 'contractor_rate', 'effective_from',
            'variable_pays', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'variable_pays']


class EmployeeStatutoryInfoSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeStatutoryInfo
        fields = [
            'id', 'employee_id', 'pan_number', 'pf_number', 'esi_number', 'lwf_applicable',
            'professional_tax_state', 'professional_tax_exempt', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class EmployeeDeductionSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeDeduction
        fields = [
            'id', 'employee_id', 'deduction_type', 'name', 'total_amount', 'installment_amount',
            'installments_remaining', 'start_date', 'is_active', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class EmployeeBenefitSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeBenefit
        fields = [
            'id', 'employee_id', 'benefit_type', 'name', 'provider', 'employee_contribution',
            'employer_contribution', 'effective_from', 'is_active', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class PayrollOvertimeAdjustmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayrollOvertimeAdjustment
        fields = [
            'id', 'employee_id', 'pay_period_month', 'overtime_hours', 'overtime_rate_multiplier',
            'leave_adjustment_days', 'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class EmployeePayrollStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeePayrollStatus
        fields = [
            'id', 'employee_id', 'is_payroll_enabled', 'disabled_reason', 'effective_from',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
