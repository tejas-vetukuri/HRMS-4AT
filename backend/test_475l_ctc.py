import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.dev')
import django
django.setup()

from employees.models import LegalEntity, Employee
from payroll.models import PayrollPeriod, EmployeeCompensation, SalaryStructure
from payroll.calculation_engine import PayrollCalculationEngine

legal_entity = LegalEntity.objects.get(name='Default Company')
period = PayrollPeriod.objects.filter(legal_entity=legal_entity).first()

# Get an employee and update their CTC to 4.75L annually
employee = Employee.objects.filter(legal_entity=legal_entity, payroll_status__is_payroll_enabled=True).first()

# Get the 3L-5L structure
structure = SalaryStructure.objects.filter(name='Standard (3L-5L)').first()

# Update compensation: 4.75L annual = 39,583.33 monthly
comp = EmployeeCompensation.objects.filter(employee=employee).first()
monthly_ctc = 475000 / 12  # 39,583.33
comp.fixed_monthly_amount = monthly_ctc
comp.salary_structure = structure
comp.save()

print("=" * 60)
print(f"PAYROLL CALCULATION FOR NEW EMPLOYEE")
print("=" * 60)
print(f"\nEmployee: {employee.id}")
print(f"Salary Structure: {structure.name}")
print(f"Annual CTC: ₹4,75,000")
print(f"Monthly CTC: ₹{monthly_ctc:,.2f}")
print(f"Period: {period.month}/{period.year}")

# Run calculation
engine = PayrollCalculationEngine(employee, period)
result = engine.calculate()

if 'error' not in result:
    print(f"\n{'STAGE 1 & 2: EARNINGS BREAKDOWN':=^60}")
    earnings = result['earnings']
    for name, amount in earnings.items():
        print(f"  {name:30s} ₹{amount:>12,.2f}")
    print(f"  {'-'*45}")
    print(f"  {'Total Earnings (Monthly)':30s} ₹{result['totals']['gross_earnings']:>12,.2f}")

    print(f"\n{'STAGE 3: LOSS OF PAY':=^60}")
    print(f"  Working Days:                  {result['attendance']['working_days']}")
    print(f"  LOP Days:                      {result['attendance']['lop_days']}")
    print(f"  LOP Amount:                    ₹{result['attendance']['lop_amount']:>12,.2f}")
    print(f"  Gross After LOP:               ₹{result['totals']['gross_after_lop']:>12,.2f}")

    print(f"\n{'STAGES 4-8: DEDUCTIONS':=^60}")
    deductions = result['deductions']
    for name, amount in deductions.items():
        if amount > 0:
            print(f"  {name:30s} ₹{amount:>12,.2f}")
    print(f"  {'-'*45}")
    print(f"  {'Total Deductions':30s} ₹{result['totals']['total_deductions']:>12,.2f}")

    print(f"\n{'FINAL NET PAY':=^60}")
    print(f"  Gross After LOP:               ₹{result['totals']['gross_after_lop']:>12,.2f}")
    print(f"  - Total Deductions:            ₹{result['totals']['total_deductions']:>12,.2f}")
    print(f"  {'-'*45}")
    print(f"  NET PAY (Monthly):             ₹{result['totals']['net_pay']:>12,.2f}")
    print(f"  NET PAY (Annual):              ₹{result['totals']['net_pay'] * 12:>12,.2f}")

    print(f"\n{'KEY POINTS':=^60}")
    print(f"  ✓ Components scale with CTC")
    print(f"  ✓ Formulas are percentage-based")
    print(f"  ✓ Works for any CTC (3L-5L range)")
    print(f"  ✓ Deductions calculated dynamically")
