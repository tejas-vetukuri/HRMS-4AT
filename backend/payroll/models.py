import uuid
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator


class LegalEntity(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    pan = models.CharField(max_length=10, unique=True)
    tan = models.CharField(max_length=10, blank=True, null=True)
    gstin = models.CharField(max_length=15, blank=True, null=True)
    state = models.CharField(max_length=2)
    address = models.TextField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Legal Entities"
        ordering = ['name']

    def __str__(self):
        return self.name


class PaySchedule(models.Model):
    FREQUENCY_CHOICES = [
        ('weekly', 'Weekly'),
        ('biweekly', 'Bi-weekly'),
        ('semimonthly', 'Semi-monthly'),
        ('monthly', 'Monthly'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    frequency = models.CharField(max_length=20, choices=FREQUENCY_CHOICES)
    pay_period_start_day = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(31)]
    )
    cutoff_day = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(31)]
    )
    pay_date_offset_days = models.IntegerField(default=3)
    first_cycle_start_date = models.DateField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class StatutoryConfig(models.Model):
    CONTRIBUTION_TYPE_CHOICES = [
        ('PF', 'Provident Fund'),
        ('ESI', 'Employee State Insurance'),
        ('LWF', 'Labor Welfare Fund'),
        ('PROFESSIONAL_TAX', 'Professional Tax'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    legal_entity = models.ForeignKey(LegalEntity, on_delete=models.CASCADE, related_name='statutory_configs')
    contribution_type = models.CharField(max_length=20, choices=CONTRIBUTION_TYPE_CHOICES)
    is_enabled = models.BooleanField(default=True)
    registration_number = models.CharField(max_length=50)
    effective_date = models.DateField()
    signatory_name = models.CharField(max_length=255)
    signatory_designation = models.CharField(max_length=100)
    signatory_pan = models.CharField(max_length=10)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('legal_entity', 'contribution_type')
        verbose_name_plural = "Statutory Configs"
        ordering = ['legal_entity', 'contribution_type']

    def __str__(self):
        return f"{self.legal_entity.name} - {self.get_contribution_type_display()}"


class SalaryComponent(models.Model):
    COMPONENT_TYPE_CHOICES = [
        ('earning', 'Earning'),
        ('deduction', 'Deduction'),
    ]
    CALCULATION_TYPE_CHOICES = [
        ('fixed', 'Fixed Amount'),
        ('percentage_of_basic', 'Percentage of Basic'),
        ('formula', 'Formula'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True)
    component_type = models.CharField(max_length=20, choices=COMPONENT_TYPE_CHOICES)
    calculation_type = models.CharField(max_length=20, choices=CALCULATION_TYPE_CHOICES)
    formula_expr = models.TextField(blank=True, null=True, help_text="Spreadsheet-like formula for 'formula' type")
    default_value = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    is_taxable = models.BooleanField(default=True)
    is_statutory = models.BooleanField(default=False, help_text="PF/ESI-linked; read-only once used")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['component_type', 'name']

    def __str__(self):
        return self.name


class SalaryStructure(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    min_salary = models.DecimalField(max_digits=12, decimal_places=2)
    max_salary = models.DecimalField(max_digits=12, decimal_places=2)
    legal_entity = models.ForeignKey(LegalEntity, on_delete=models.CASCADE, related_name='salary_structures')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('legal_entity', 'name')
        ordering = ['legal_entity', 'name']

    def __str__(self):
        return self.name


class SalaryStructureComponent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    structure = models.ForeignKey(SalaryStructure, on_delete=models.CASCADE, related_name='components')
    component = models.ForeignKey(SalaryComponent, on_delete=models.PROTECT)
    order = models.IntegerField(default=0)
    value_override = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('structure', 'component')
        ordering = ['order']

    def __str__(self):
        return f"{self.structure.name} - {self.component.name}"


class TaxFilingConfig(models.Model):
    FILING_FREQUENCY_CHOICES = [
        ('quarterly', 'Quarterly'),
        ('half_yearly', 'Half Yearly'),
        ('annual', 'Annual'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    legal_entity = models.OneToOneField(LegalEntity, on_delete=models.CASCADE, related_name='tax_filing_config')
    filing_frequency = models.CharField(max_length=20, choices=FILING_FREQUENCY_CHOICES)
    state_tax_id = models.CharField(max_length=50, blank=True, null=True)
    federal_tax_id = models.CharField(max_length=50, blank=True, null=True)
    effective_from = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Tax Filing Configs"

    def __str__(self):
        return f"Tax Filing - {self.legal_entity.name}"


class PayStubTemplate(models.Model):
    APPLIES_TO_CHOICES = [
        ('employee', 'Employee'),
        ('contractor', 'Contractor'),
    ]
    DELIVERY_METHOD_CHOICES = [
        ('email', 'Email'),
        ('portal', 'Portal'),
        ('both', 'Both'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    applies_to = models.CharField(max_length=20, choices=APPLIES_TO_CHOICES)
    logo_document_id = models.UUIDField(blank=True, null=True, help_text="Reference to documents.Document.id")
    layout_json = models.JSONField(
        default=dict,
        help_text="{sections: ['header','earnings','deductions','tax','summary'], footer_text: '...'}",
    )
    delivery_method = models.CharField(max_length=20, choices=DELIVERY_METHOD_CHOICES, default='email')
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('name', 'applies_to')
        ordering = ['-is_default', 'name']

    def __str__(self):
        return f"{self.name} ({self.get_applies_to_display()})"


class PayGroup(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    legal_entity = models.ForeignKey(LegalEntity, on_delete=models.CASCADE, related_name='pay_groups')
    pay_schedule = models.ForeignKey(PaySchedule, on_delete=models.PROTECT)
    default_salary_structure = models.ForeignKey(
        SalaryStructure, on_delete=models.SET_NULL, blank=True, null=True
    )
    approver_id = models.UUIDField(help_text="Reference to employees.Employee.id")
    maker_checker_enabled = models.BooleanField(default=True)
    approval_threshold_amount = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('legal_entity', 'name')
        ordering = ['legal_entity', 'name']

    def __str__(self):
        return self.name


# ======================== Payroll Inputs (Employee-level) ========================


class EmployeePaymentInfo(models.Model):
    PAYMENT_METHOD_CHOICES = [
        ('direct_deposit', 'Direct Deposit'),
        ('cash', 'Cash'),
        ('paper_check', 'Paper Check'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee_id = models.UUIDField(unique=True, help_text="Reference to employees.Employee.id")
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES)
    bank_name = models.CharField(max_length=255, blank=True)
    bank_account_number = models.CharField(max_length=50, blank=True)
    bank_ifsc_code = models.CharField(max_length=11, blank=True)
    bank_account_holder_name = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Employee Payment Info"
        ordering = ['employee_id']

    def __str__(self):
        return f"Payment Info - {self.employee_id}"


class EmployeeCompensation(models.Model):
    CONTRACTOR_RATE_TYPE_CHOICES = [
        ('fixed', 'Fixed'),
        ('hourly', 'Hourly'),
        ('variable', 'Variable'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee_id = models.UUIDField(unique=True, help_text="Reference to employees.Employee.id")
    salary_structure = models.ForeignKey(
        SalaryStructure, on_delete=models.SET_NULL, blank=True, null=True
    )
    fixed_monthly_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    is_contractor = models.BooleanField(default=False)
    contractor_rate_type = models.CharField(
        max_length=20, choices=CONTRACTOR_RATE_TYPE_CHOICES, blank=True, null=True
    )
    contractor_rate = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    effective_from = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Employee Compensation"
        ordering = ['employee_id']

    def __str__(self):
        return f"Compensation - {self.employee_id}"


class EmployeeVariablePay(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    compensation = models.ForeignKey(EmployeeCompensation, on_delete=models.CASCADE, related_name='variable_pays')
    component = models.ForeignKey(SalaryComponent, on_delete=models.PROTECT)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    pay_month = models.DateField(help_text="Month for which this variable pay applies (first day of month)")
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('compensation', 'component', 'pay_month')
        ordering = ['-pay_month']

    def __str__(self):
        return f"Variable Pay - {self.compensation.employee_id} - {self.component.name}"


class EmployeeStatutoryInfo(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee_id = models.UUIDField(unique=True, help_text="Reference to employees.Employee.id")
    pan_number = models.CharField(max_length=10, unique=True)
    pf_number = models.CharField(max_length=50, blank=True, help_text="UAN (Universal Account Number)")
    esi_number = models.CharField(max_length=50, blank=True)
    lwf_applicable = models.BooleanField(default=False)
    professional_tax_state = models.CharField(max_length=2, blank=True)
    professional_tax_exempt = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Employee Statutory Info"
        ordering = ['employee_id']

    def __str__(self):
        return f"Statutory Info - {self.employee_id}"


class EmployeeDeduction(models.Model):
    DEDUCTION_TYPE_CHOICES = [
        ('loan', 'Loan'),
        ('advance', 'Advance'),
        ('custom', 'Custom'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee_id = models.UUIDField(help_text="Reference to employees.Employee.id")
    deduction_type = models.CharField(max_length=20, choices=DEDUCTION_TYPE_CHOICES)
    name = models.CharField(max_length=255)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    installment_amount = models.DecimalField(max_digits=12, decimal_places=2)
    installments_remaining = models.IntegerField(default=0)
    start_date = models.DateField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['employee_id', 'start_date']

    def __str__(self):
        return f"{self.name} - {self.employee_id}"


class EmployeeBenefit(models.Model):
    BENEFIT_TYPE_CHOICES = [
        ('health_insurance', 'Health Insurance'),
        ('retirement', 'Retirement'),
        ('other', 'Other'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee_id = models.UUIDField(help_text="Reference to employees.Employee.id")
    benefit_type = models.CharField(max_length=50, choices=BENEFIT_TYPE_CHOICES)
    name = models.CharField(max_length=255)
    provider = models.CharField(max_length=255, blank=True)
    employee_contribution = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    employer_contribution = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    effective_from = models.DateField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['employee_id', 'benefit_type']

    def __str__(self):
        return f"{self.name} - {self.employee_id}"


class PayrollOvertimeAdjustment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee_id = models.UUIDField(help_text="Reference to employees.Employee.id")
    pay_period_month = models.DateField(help_text="First day of the month for which this adjustment applies")
    overtime_hours = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    overtime_rate_multiplier = models.DecimalField(max_digits=4, decimal_places=2, default=1.5)
    leave_adjustment_days = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('employee_id', 'pay_period_month')
        ordering = ['-pay_period_month']

    def __str__(self):
        return f"Overtime Adjustment - {self.employee_id} - {self.pay_period_month}"


class EmployeePayrollStatus(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee_id = models.UUIDField(unique=True, help_text="Reference to employees.Employee.id")
    is_payroll_enabled = models.BooleanField(default=True)
    disabled_reason = models.TextField(blank=True, null=True)
    effective_from = models.DateField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Employee Payroll Status"
        ordering = ['employee_id']

    def __str__(self):
        return f"Payroll Status - {self.employee_id} - {'Enabled' if self.is_payroll_enabled else 'Disabled'}"
