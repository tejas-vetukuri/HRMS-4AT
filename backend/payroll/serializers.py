from rest_framework import serializers

from . import models


def _serializer(model_cls, name, **extra_fields):
    """Build a `fields="__all__"` ModelSerializer, plus any extra declared
    fields passed as kwargs (e.g. read-only `*_name` lookups the frontend
    reads). `fields="__all__"` includes explicitly declared fields too."""
    attrs = {"Meta": type("Meta", (), {"model": model_cls, "fields": "__all__"})}
    attrs.update(extra_fields)
    return type(name, (serializers.ModelSerializer,), attrs)


_ro = serializers.ReadOnlyField  # returns None if any object in the source chain is None


LegalEntityPayrollProfileSerializer = _serializer(
    models.LegalEntityPayrollProfile, "LegalEntityPayrollProfileSerializer"
)
PayScheduleSerializer = _serializer(models.PaySchedule, "PayScheduleSerializer")
StatutoryConfigSerializer = _serializer(
    models.StatutoryConfig,
    "StatutoryConfigSerializer",
    legal_entity_name=_ro(source="legal_entity.name"),
)
SalaryComponentSerializer = _serializer(models.SalaryComponent, "SalaryComponentSerializer")
SalaryStructureSerializer = _serializer(
    models.SalaryStructure,
    "SalaryStructureSerializer",
    legal_entity_name=_ro(source="legal_entity.name"),
)
SalaryStructureComponentSerializer = _serializer(
    models.SalaryStructureComponent, "SalaryStructureComponentSerializer"
)
TaxFilingConfigSerializer = _serializer(
    models.TaxFilingConfig,
    "TaxFilingConfigSerializer",
    legal_entity_name=_ro(source="legal_entity.name"),
)
PayStubTemplateSerializer = _serializer(models.PayStubTemplate, "PayStubTemplateSerializer")
PayGroupSerializer = _serializer(
    models.PayGroup,
    "PayGroupSerializer",
    legal_entity_name=_ro(source="legal_entity.name"),
    pay_schedule_name=_ro(source="pay_schedule.name"),
)

EmployeePaymentInfoSerializer = _serializer(
    models.EmployeePaymentInfo, "EmployeePaymentInfoSerializer"
)
EmployeeCompensationSerializer = _serializer(
    models.EmployeeCompensation,
    "EmployeeCompensationSerializer",
    salary_structure_name=_ro(source="salary_structure.name"),
)
EmployeeVariablePaySerializer = _serializer(
    models.EmployeeVariablePay, "EmployeeVariablePaySerializer"
)
EmployeeStatutoryInfoSerializer = _serializer(
    models.EmployeeStatutoryInfo, "EmployeeStatutoryInfoSerializer"
)
EmployeeDeductionSerializer = _serializer(models.EmployeeDeduction, "EmployeeDeductionSerializer")
EmployeeBenefitSerializer = _serializer(models.EmployeeBenefit, "EmployeeBenefitSerializer")
PayrollOvertimeAdjustmentSerializer = _serializer(
    models.PayrollOvertimeAdjustment, "PayrollOvertimeAdjustmentSerializer"
)
EmployeePayrollStatusSerializer = _serializer(
    models.EmployeePayrollStatus, "EmployeePayrollStatusSerializer"
)
