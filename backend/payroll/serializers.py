from rest_framework import serializers

from . import models


def _serializer(model_cls, name):
    return type(
        name,
        (serializers.ModelSerializer,),
        {
            "Meta": type("Meta", (), {"model": model_cls, "fields": "__all__"}),
        },
    )


LegalEntityPayrollProfileSerializer = _serializer(
    models.LegalEntityPayrollProfile, "LegalEntityPayrollProfileSerializer"
)
PayScheduleSerializer = _serializer(models.PaySchedule, "PayScheduleSerializer")
StatutoryConfigSerializer = _serializer(models.StatutoryConfig, "StatutoryConfigSerializer")
SalaryComponentSerializer = _serializer(models.SalaryComponent, "SalaryComponentSerializer")
SalaryStructureSerializer = _serializer(models.SalaryStructure, "SalaryStructureSerializer")
SalaryStructureComponentSerializer = _serializer(
    models.SalaryStructureComponent, "SalaryStructureComponentSerializer"
)
TaxFilingConfigSerializer = _serializer(models.TaxFilingConfig, "TaxFilingConfigSerializer")
PayStubTemplateSerializer = _serializer(models.PayStubTemplate, "PayStubTemplateSerializer")
PayGroupSerializer = _serializer(models.PayGroup, "PayGroupSerializer")

EmployeePaymentInfoSerializer = _serializer(
    models.EmployeePaymentInfo, "EmployeePaymentInfoSerializer"
)
EmployeeCompensationSerializer = _serializer(
    models.EmployeeCompensation, "EmployeeCompensationSerializer"
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
