from rest_framework import viewsets, permissions, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.decorators import action
from rest_framework.response import Response
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
from .serializers import (
    LegalEntitySerializer,
    PayScheduleSerializer,
    StatutoryConfigSerializer,
    SalaryComponentSerializer,
    SalaryStructureSerializer,
    SalaryStructureComponentSerializer,
    TaxFilingConfigSerializer,
    PayStubTemplateSerializer,
    PayGroupSerializer,
    EmployeePaymentInfoSerializer,
    EmployeeCompensationSerializer,
    EmployeeVariablePaySerializer,
    EmployeeStatutoryInfoSerializer,
    EmployeeDeductionSerializer,
    EmployeeBenefitSerializer,
    PayrollOvertimeAdjustmentSerializer,
    EmployeePayrollStatusSerializer,
)


class StandardPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class IsPayrollFinance(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user and hasattr(request.user, 'has_perm') and request.user.has_perm('payroll.read')
        return request.user and hasattr(request.user, 'has_perm') and request.user.has_perm('payroll.write')


class LegalEntityViewSet(viewsets.ModelViewSet):
    queryset = LegalEntity.objects.all()
    serializer_class = LegalEntitySerializer
    permission_classes = [IsPayrollFinance]
    pagination_class = StandardPagination


class PayScheduleViewSet(viewsets.ModelViewSet):
    queryset = PaySchedule.objects.all()
    serializer_class = PayScheduleSerializer
    permission_classes = [IsPayrollFinance]
    pagination_class = StandardPagination


class StatutoryConfigViewSet(viewsets.ModelViewSet):
    queryset = StatutoryConfig.objects.all()
    serializer_class = StatutoryConfigSerializer
    permission_classes = [IsPayrollFinance]
    pagination_class = StandardPagination

    def get_queryset(self):
        queryset = super().get_queryset()
        legal_entity_id = self.request.query_params.get('legal_entity_id')
        if legal_entity_id:
            queryset = queryset.filter(legal_entity_id=legal_entity_id)
        return queryset


class SalaryComponentViewSet(viewsets.ModelViewSet):
    queryset = SalaryComponent.objects.all()
    serializer_class = SalaryComponentSerializer
    permission_classes = [IsPayrollFinance]
    pagination_class = StandardPagination


class SalaryStructureViewSet(viewsets.ModelViewSet):
    queryset = SalaryStructure.objects.all()
    serializer_class = SalaryStructureSerializer
    permission_classes = [IsPayrollFinance]
    pagination_class = StandardPagination

    def get_queryset(self):
        queryset = super().get_queryset()
        legal_entity_id = self.request.query_params.get('legal_entity_id')
        if legal_entity_id:
            queryset = queryset.filter(legal_entity_id=legal_entity_id)
        return queryset


class SalaryStructureComponentViewSet(viewsets.ModelViewSet):
    queryset = SalaryStructureComponent.objects.all()
    serializer_class = SalaryStructureComponentSerializer
    permission_classes = [IsPayrollFinance]
    pagination_class = StandardPagination

    def get_queryset(self):
        queryset = super().get_queryset()
        structure_id = self.request.query_params.get('structure_id')
        if structure_id:
            queryset = queryset.filter(structure_id=structure_id)
        return queryset


class TaxFilingConfigViewSet(viewsets.ModelViewSet):
    queryset = TaxFilingConfig.objects.all()
    serializer_class = TaxFilingConfigSerializer
    permission_classes = [IsPayrollFinance]
    pagination_class = StandardPagination


class PayStubTemplateViewSet(viewsets.ModelViewSet):
    queryset = PayStubTemplate.objects.all()
    serializer_class = PayStubTemplateSerializer
    permission_classes = [IsPayrollFinance]
    pagination_class = StandardPagination


class PayGroupViewSet(viewsets.ModelViewSet):
    queryset = PayGroup.objects.all()
    serializer_class = PayGroupSerializer
    permission_classes = [IsPayrollFinance]
    pagination_class = StandardPagination

    def get_queryset(self):
        queryset = super().get_queryset()
        legal_entity_id = self.request.query_params.get('legal_entity_id')
        if legal_entity_id:
            queryset = queryset.filter(legal_entity_id=legal_entity_id)
        return queryset


# ======================== Payroll Inputs ViewSets ========================


class EmployeePaymentInfoViewSet(viewsets.ModelViewSet):
    queryset = EmployeePaymentInfo.objects.all()
    serializer_class = EmployeePaymentInfoSerializer
    permission_classes = [IsPayrollFinance]
    pagination_class = StandardPagination

    def get_queryset(self):
        queryset = super().get_queryset()
        employee_id = self.request.query_params.get('employee_id')
        if employee_id:
            queryset = queryset.filter(employee_id=employee_id)
        return queryset


class EmployeeCompensationViewSet(viewsets.ModelViewSet):
    queryset = EmployeeCompensation.objects.all()
    serializer_class = EmployeeCompensationSerializer
    permission_classes = [IsPayrollFinance]
    pagination_class = StandardPagination

    def get_queryset(self):
        queryset = super().get_queryset()
        employee_id = self.request.query_params.get('employee_id')
        if employee_id:
            queryset = queryset.filter(employee_id=employee_id)
        return queryset


class EmployeeVariablePayViewSet(viewsets.ModelViewSet):
    queryset = EmployeeVariablePay.objects.all()
    serializer_class = EmployeeVariablePaySerializer
    permission_classes = [IsPayrollFinance]
    pagination_class = StandardPagination

    def get_queryset(self):
        queryset = super().get_queryset()
        compensation_id = self.request.query_params.get('compensation_id')
        if compensation_id:
            queryset = queryset.filter(compensation_id=compensation_id)
        return queryset


class EmployeeStatutoryInfoViewSet(viewsets.ModelViewSet):
    queryset = EmployeeStatutoryInfo.objects.all()
    serializer_class = EmployeeStatutoryInfoSerializer
    permission_classes = [IsPayrollFinance]
    pagination_class = StandardPagination

    def get_queryset(self):
        queryset = super().get_queryset()
        employee_id = self.request.query_params.get('employee_id')
        if employee_id:
            queryset = queryset.filter(employee_id=employee_id)
        return queryset


class EmployeeDeductionViewSet(viewsets.ModelViewSet):
    queryset = EmployeeDeduction.objects.all()
    serializer_class = EmployeeDeductionSerializer
    permission_classes = [IsPayrollFinance]
    pagination_class = StandardPagination

    def get_queryset(self):
        queryset = super().get_queryset()
        employee_id = self.request.query_params.get('employee_id')
        if employee_id:
            queryset = queryset.filter(employee_id=employee_id)
        return queryset


class EmployeeBenefitViewSet(viewsets.ModelViewSet):
    queryset = EmployeeBenefit.objects.all()
    serializer_class = EmployeeBenefitSerializer
    permission_classes = [IsPayrollFinance]
    pagination_class = StandardPagination

    def get_queryset(self):
        queryset = super().get_queryset()
        employee_id = self.request.query_params.get('employee_id')
        if employee_id:
            queryset = queryset.filter(employee_id=employee_id)
        return queryset


class PayrollOvertimeAdjustmentViewSet(viewsets.ModelViewSet):
    queryset = PayrollOvertimeAdjustment.objects.all()
    serializer_class = PayrollOvertimeAdjustmentSerializer
    permission_classes = [IsPayrollFinance]
    pagination_class = StandardPagination

    def get_queryset(self):
        queryset = super().get_queryset()
        employee_id = self.request.query_params.get('employee_id')
        if employee_id:
            queryset = queryset.filter(employee_id=employee_id)
        return queryset


class EmployeePayrollStatusViewSet(viewsets.ModelViewSet):
    queryset = EmployeePayrollStatus.objects.all()
    serializer_class = EmployeePayrollStatusSerializer
    permission_classes = [IsPayrollFinance]
    pagination_class = StandardPagination

    def get_queryset(self):
        queryset = super().get_queryset()
        employee_id = self.request.query_params.get('employee_id')
        if employee_id:
            queryset = queryset.filter(employee_id=employee_id)
        return queryset
