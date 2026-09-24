import uuid

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

# Integrated with the core: the company legal entity is employees.LegalEntity
# (single source of truth). Payroll-specific registration details hang off it
# via a OneToOne profile instead of a duplicate LegalEntity model. Employee-
# owned rows link to employees.Employee through an `employee` FK so the core's
# ScopedEmployeePermission / resolve_employee_scope can scope them.


class LegalEntityPayrollProfile(models.Model):
    """Payroll registration details for a core LegalEntity (PAN/TAN/GSTIN…)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    legal_entity = models.OneToOneField(
        "employees.LegalEntity", on_delete=models.CASCADE, related_name="payroll_profile"
    )
    pan = models.CharField(max_length=10, unique=True)
    tan = models.CharField(max_length=10, blank=True, null=True)
    gstin = models.CharField(max_length=15, blank=True, null=True)
    state = models.CharField(max_length=2)
    address = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Payroll profile - {self.legal_entity.name}"


class PaySchedule(models.Model):
    FREQUENCY_CHOICES = [
        ("weekly", "Weekly"),
        ("biweekly", "Bi-weekly"),
        ("semimonthly", "Semi-monthly"),
        ("monthly", "Monthly"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    frequency = models.CharField(max_length=20, choices=FREQUENCY_CHOICES)
    pay_period_start_day = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(31)]
    )
    cutoff_day = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(31)])
    pay_date_offset_days = models.IntegerField(default=3)
    first_cycle_start_date = models.DateField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class StatutoryConfig(models.Model):
    CONTRIBUTION_TYPE_CHOICES = [
        ("PF", "Provident Fund"),
        ("ESI", "Employee State Insurance"),
        ("LWF", "Labor Welfare Fund"),
        ("PROFESSIONAL_TAX", "Professional Tax"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    legal_entity = models.ForeignKey(
        "employees.LegalEntity", on_delete=models.CASCADE, related_name="statutory_configs"
    )
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
        unique_together = ("legal_entity", "contribution_type")
        verbose_name_plural = "Statutory Configs"
        ordering = ["legal_entity", "contribution_type"]

    def __str__(self):
        return f"{self.legal_entity.name} - {self.get_contribution_type_display()}"


class SalaryComponent(models.Model):
    COMPONENT_TYPE_CHOICES = [("earning", "Earning"), ("deduction", "Deduction")]
    CALCULATION_TYPE_CHOICES = [
        ("fixed", "Fixed Amount"),
        ("percentage_of_basic", "Percentage of Basic"),
        ("formula", "Formula"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True)
    component_type = models.CharField(max_length=20, choices=COMPONENT_TYPE_CHOICES)
    calculation_type = models.CharField(max_length=20, choices=CALCULATION_TYPE_CHOICES)
    formula_expr = models.TextField(blank=True, null=True, help_text="Formula for 'formula' type")
    default_value = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    is_taxable = models.BooleanField(default=True)
    is_statutory = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["component_type", "name"]

    def __str__(self):
        return self.name


class SalaryStructure(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    min_salary = models.DecimalField(max_digits=12, decimal_places=2)
    max_salary = models.DecimalField(max_digits=12, decimal_places=2)
    legal_entity = models.ForeignKey(
        "employees.LegalEntity", on_delete=models.CASCADE, related_name="salary_structures"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("legal_entity", "name")
        ordering = ["legal_entity", "name"]

    def __str__(self):
        return self.name


class SalaryStructureComponent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    structure = models.ForeignKey(
        SalaryStructure, on_delete=models.CASCADE, related_name="components"
    )
    component = models.ForeignKey(SalaryComponent, on_delete=models.PROTECT)
    order = models.IntegerField(default=0)
    value_override = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("structure", "component")
        ordering = ["order"]

    def __str__(self):
        return f"{self.structure.name} - {self.component.name}"


class TaxFilingConfig(models.Model):
    FILING_FREQUENCY_CHOICES = [
        ("quarterly", "Quarterly"),
        ("half_yearly", "Half Yearly"),
        ("annual", "Annual"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    legal_entity = models.OneToOneField(
        "employees.LegalEntity", on_delete=models.CASCADE, related_name="tax_filing_config"
    )
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
    APPLIES_TO_CHOICES = [("employee", "Employee"), ("contractor", "Contractor")]
    DELIVERY_METHOD_CHOICES = [("email", "Email"), ("portal", "Portal"), ("both", "Both")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    applies_to = models.CharField(max_length=20, choices=APPLIES_TO_CHOICES)
    layout_json = models.JSONField(default=dict)
    delivery_method = models.CharField(
        max_length=20, choices=DELIVERY_METHOD_CHOICES, default="email"
    )
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("name", "applies_to")
        ordering = ["-is_default", "name"]

    def __str__(self):
        return f"{self.name} ({self.get_applies_to_display()})"


class PayGroup(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    legal_entity = models.ForeignKey(
        "employees.LegalEntity", on_delete=models.CASCADE, related_name="pay_groups"
    )
    pay_schedule = models.ForeignKey(PaySchedule, on_delete=models.PROTECT)
    default_salary_structure = models.ForeignKey(
        SalaryStructure, on_delete=models.SET_NULL, blank=True, null=True
    )
    approver = models.ForeignKey(
        "employees.Employee", on_delete=models.PROTECT, related_name="payroll_approver_groups"
    )
    maker_checker_enabled = models.BooleanField(default=True)
    approval_threshold_amount = models.DecimalField(
        max_digits=12, decimal_places=2, blank=True, null=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("legal_entity", "name")
        ordering = ["legal_entity", "name"]

    def __str__(self):
        return self.name


# ======================== Payroll Inputs (Employee-level) ========================
# Each of these links to a person through `employee` -> employees.Employee, so
# the core scope-checks every row through it.


class EmployeePaymentInfo(models.Model):
    PAYMENT_METHOD_CHOICES = [
        ("direct_deposit", "Direct Deposit"),
        ("cash", "Cash"),
        ("paper_check", "Paper Check"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.OneToOneField(
        "employees.Employee", on_delete=models.CASCADE, related_name="payroll_payment_info"
    )
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES)
    bank_name = models.CharField(max_length=255, blank=True)
    bank_account_number = models.CharField(max_length=50, blank=True)
    bank_ifsc_code = models.CharField(max_length=11, blank=True)
    bank_account_holder_name = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Employee Payment Info"
        ordering = ["employee"]

    def __str__(self):
        return f"Payment Info - {self.employee_id}"


class EmployeeCompensation(models.Model):
    CONTRACTOR_RATE_TYPE_CHOICES = [
        ("fixed", "Fixed"),
        ("hourly", "Hourly"),
        ("variable", "Variable"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.OneToOneField(
        "employees.Employee", on_delete=models.CASCADE, related_name="payroll_compensation"
    )
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
        ordering = ["employee"]

    def __str__(self):
        return f"Compensation - {self.employee_id}"


class EmployeeVariablePay(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    compensation = models.ForeignKey(
        EmployeeCompensation, on_delete=models.CASCADE, related_name="variable_pays"
    )
    component = models.ForeignKey(SalaryComponent, on_delete=models.PROTECT)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    pay_month = models.DateField()
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("compensation", "component", "pay_month")
        ordering = ["-pay_month"]

    @property
    def employee_id(self):
        # Lets ScopedEmployeePermission.has_object_permission scope this row
        # through its parent compensation's employee.
        return self.compensation.employee_id

    def __str__(self):
        return f"Variable Pay - {self.compensation_id} - {self.component.name}"


class EmployeeStatutoryInfo(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.OneToOneField(
        "employees.Employee", on_delete=models.CASCADE, related_name="payroll_statutory_info"
    )
    pan_number = models.CharField(max_length=10, unique=True)
    pf_number = models.CharField(max_length=50, blank=True)
    esi_number = models.CharField(max_length=50, blank=True)
    lwf_applicable = models.BooleanField(default=False)
    professional_tax_state = models.CharField(max_length=2, blank=True)
    professional_tax_exempt = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Employee Statutory Info"
        ordering = ["employee"]

    def __str__(self):
        return f"Statutory Info - {self.employee_id}"


class EmployeeDeduction(models.Model):
    DEDUCTION_TYPE_CHOICES = [("loan", "Loan"), ("advance", "Advance"), ("custom", "Custom")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(
        "employees.Employee", on_delete=models.CASCADE, related_name="payroll_deductions"
    )
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
        ordering = ["employee", "start_date"]

    def __str__(self):
        return f"{self.name} - {self.employee_id}"


class EmployeeBenefit(models.Model):
    BENEFIT_TYPE_CHOICES = [
        ("health_insurance", "Health Insurance"),
        ("retirement", "Retirement"),
        ("other", "Other"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(
        "employees.Employee", on_delete=models.CASCADE, related_name="payroll_benefits"
    )
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
        ordering = ["employee", "benefit_type"]

    def __str__(self):
        return f"{self.name} - {self.employee_id}"


class PayrollOvertimeAdjustment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(
        "employees.Employee", on_delete=models.CASCADE, related_name="payroll_overtime_adjustments"
    )
    pay_period_month = models.DateField()
    overtime_hours = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    overtime_rate_multiplier = models.DecimalField(max_digits=4, decimal_places=2, default=1.5)
    leave_adjustment_days = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("employee", "pay_period_month")
        ordering = ["-pay_period_month"]

    def __str__(self):
        return f"Overtime Adjustment - {self.employee_id} - {self.pay_period_month}"


class EmployeePayrollStatus(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.OneToOneField(
        "employees.Employee", on_delete=models.CASCADE, related_name="payroll_status"
    )
    is_payroll_enabled = models.BooleanField(default=True)
    disabled_reason = models.TextField(blank=True, null=True)
    effective_from = models.DateField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Employee Payroll Status"
        ordering = ["employee"]

    def __str__(self):
        return f"Payroll Status - {self.employee_id}"


# ======================== Payroll Calculation Engine ========================


class PayrollPeriod(models.Model):
    """A payroll period (month/year) for which payroll is calculated."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    legal_entity = models.ForeignKey(
        "employees.LegalEntity", on_delete=models.CASCADE, related_name="payroll_periods"
    )
    year = models.IntegerField()
    month = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(12)])
    start_date = models.DateField()
    end_date = models.DateField()
    working_days = models.IntegerField(default=30)
    is_locked = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("legal_entity", "year", "month")
        ordering = ["-year", "-month"]

    def __str__(self):
        return f"Payroll {self.month}/{self.year}"


class PayrollRun(models.Model):
    """Tracks a payroll run for a period."""

    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("processing", "Processing"),
        ("completed", "Completed"),
        ("approved", "Approved"),
        ("locked", "Locked"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    period = models.ForeignKey(
        PayrollPeriod, on_delete=models.CASCADE, related_name="runs"
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")
    processed_count = models.IntegerField(default=0)
    error_count = models.IntegerField(default=0)
    total_net_pay = models.DecimalField(
        max_digits=15, decimal_places=2, default=0
    )
    created_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, related_name="payroll_runs_created"
    )
    approved_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="payroll_runs_approved"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Payroll Run - {self.period}"


class PayrollResult(models.Model):
    """Final calculated payroll for an employee in a period."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    run = models.ForeignKey(
        PayrollRun, on_delete=models.CASCADE, related_name="results"
    )
    employee = models.ForeignKey(
        "employees.Employee", on_delete=models.CASCADE, related_name="payroll_results"
    )

    # Earnings (calculated from salary structure)
    earnings_json = models.JSONField(default=dict)  # {basic, hra, sa, medical, ...}
    total_earnings = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # Attendance & LOP
    working_days = models.IntegerField(default=0)
    lop_days = models.IntegerField(default=0)
    lop_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    gross_after_lop = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # Deductions (calculated from rules)
    deductions_json = models.JSONField(default=dict)  # {employee_pf, pt, tds, insurance, ...}
    total_deductions = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # One-time adjustments
    adjustments_json = models.JSONField(default=dict)  # {dip, bonus, arrear, ...}
    total_adjustments = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # Final result
    net_pay = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # Previous month comparison
    previous_net_pay = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    variance = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    # Status
    is_approved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("run", "employee")
        ordering = ["-run__created_at", "employee"]

    def __str__(self):
        return f"Payroll - {self.employee_id} - {self.run.period}"


class LopConfiguration(models.Model):
    """Configuration for Loss of Pay (LOP) calculation."""

    DAY_BASIS_CHOICES = [
        ("fixed_30", "Fixed 30 Days"),
        ("calendar_days", "Calendar Days"),
        ("working_days", "Working Days"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    legal_entity = models.OneToOneField(
        "employees.LegalEntity", on_delete=models.CASCADE, related_name="lop_config"
    )
    day_basis = models.CharField(
        max_length=20, choices=DAY_BASIS_CHOICES, default="fixed_30"
    )
    effective_from = models.DateField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"LOP Config - {self.legal_entity.name}"


class PfRule(models.Model):
    """Provident Fund (PF) calculation rule."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    legal_entity = models.OneToOneField(
        "employees.LegalEntity", on_delete=models.CASCADE, related_name="pf_rule"
    )
    employee_pf_rate = models.DecimalField(
        max_digits=5, decimal_places=2, default=12.0, help_text="Employee PF %"
    )
    employer_pf_rate = models.DecimalField(
        max_digits=5, decimal_places=2, default=12.0, help_text="Employer PF %"
    )
    pf_wage_ceiling = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True, help_text="Max salary for PF calculation"
    )
    pf_basis = models.CharField(
        max_length=50, default="basic", help_text="Basis: basic, basic+da, configured_wage"
    )
    is_mandatory = models.BooleanField(default=True)
    effective_from = models.DateField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"PF Rule - {self.legal_entity.name}"


class PtSlab(models.Model):
    """Professional Tax (PT) slab configuration."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    legal_entity = models.ForeignKey(
        "employees.LegalEntity", on_delete=models.CASCADE, related_name="pt_slabs"
    )
    salary_from = models.DecimalField(max_digits=12, decimal_places=2)
    salary_to = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    pt_amount = models.DecimalField(max_digits=12, decimal_places=2)
    effective_from = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("legal_entity", "salary_from", "salary_to", "effective_from")
        ordering = ["legal_entity", "salary_from"]

    def __str__(self):
        return f"PT Slab {self.salary_from} - {self.salary_to or 'above'}"


class TdsConfiguration(models.Model):
    """TDS (Tax Deducted at Source) configuration."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    legal_entity = models.OneToOneField(
        "employees.LegalEntity", on_delete=models.CASCADE, related_name="tds_config"
    )
    tax_regime = models.CharField(
        max_length=20, choices=[("old", "Old Regime"), ("new", "New Regime")], default="new"
    )
    financial_year = models.CharField(max_length=10)  # e.g., "2024-25"
    # Store TDS rules as JSON for flexibility
    tds_rules = models.JSONField(default=dict)
    effective_from = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"TDS Config - {self.legal_entity.name} ({self.financial_year})"


class PayrollAdjustment(models.Model):
    """One-time payroll adjustments (DIP, Bonus, Arrears, etc.)."""

    TYPE_CHOICES = [
        ("bonus", "Bonus"),
        ("dip", "DIP"),
        ("retention", "Retention"),
        ("arrear", "Arrear"),
        ("reimbursement", "Reimbursement"),
        ("recovery", "Recovery"),
        ("other", "Other"),
    ]

    FREQUENCY_CHOICES = [
        ("one_time", "One Time"),
        ("recurring", "Recurring"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(
        "employees.Employee", on_delete=models.CASCADE, related_name="payroll_adjustments"
    )
    adjustment_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    name = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    frequency = models.CharField(max_length=20, choices=FREQUENCY_CHOICES, default="one_time")
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    description = models.TextField(blank=True)
    is_taxable = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-effective_from"]

    def __str__(self):
        return f"{self.name} - {self.employee_id}"
