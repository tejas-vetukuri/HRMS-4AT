"""
Test payroll calculation engine end-to-end.
"""
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.dev')
import django
django.setup()

import json
from datetime import date
from employees.models import LegalEntity, Employee
from payroll.models import PayrollPeriod, PayrollRun
from payroll.calculation_engine import process_payroll_for_period

# Get legal entity and period
legal_entity = LegalEntity.objects.get(name='Default Company')
period = PayrollPeriod.objects.filter(
    legal_entity=legal_entity,
    year=2026,
    month=9
).first()

if not period:
    print("❌ No payroll period found")
    exit(1)

# Get employees
employees = Employee.objects.filter(
    legal_entity=legal_entity
)[:1]  # Test with first employee

if not employees:
    print("❌ No employees found")
    exit(1)

print(f"\n🔄 Running payroll for period {period.month}/{period.year}...")
print(f"📊 Processing {employees.count()} employee(s)\n")

# Run payroll
run = process_payroll_for_period(period, employee_ids=[str(e.id) for e in employees])

print(f"✅ Payroll Run completed!")
print(f"   Status: {run.status}")
print(f"   Processed: {run.processed_count}")
print(f"   Errors: {run.error_count}")
print(f"   Total Net Pay: ₹{run.total_net_pay:,.2f}")

# Display results
print(f"\n📋 Payroll Results:\n")

for result in run.results.all():
    print(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print(f"Employee: {result.employee.first_name} {result.employee.last_name}")
    print(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

    print(f"\n📈 EARNINGS (Monthly):")
    earnings = result.earnings_json
    for name, amount in earnings.items():
        print(f"  {name:30s} ₹{amount:>12,.2f}")
    print(f"  {'-'*45}")
    print(f"  {'Total Earnings':30s} ₹{result.total_earnings:>12,.2f}")

    print(f"\n📍 ATTENDANCE:")
    print(f"  Working Days:                  {result.working_days}")
    print(f"  LOP Days:                      {result.lop_days}")
    print(f"  LOP Amount:                    ₹{result.lop_amount:>12,.2f}")
    print(f"  Gross After LOP:               ₹{result.gross_after_lop:>12,.2f}")

    print(f"\n💰 DEDUCTIONS (Monthly):")
    deductions = result.deductions_json
    for name, amount in deductions.items():
        print(f"  {name:30s} ₹{amount:>12,.2f}")
    print(f"  {'-'*45}")
    print(f"  {'Total Deductions':30s} ₹{result.total_deductions:>12,.2f}")

    if result.adjustments_json:
        print(f"\n🎁 ADJUSTMENTS (One-Time):")
        adjustments = result.adjustments_json
        for name, amount in adjustments.items():
            print(f"  {name:30s} ₹{amount:>12,.2f}")
        print(f"  {'-'*45}")
        print(f"  {'Total Adjustments':30s} ₹{result.total_adjustments:>12,.2f}")

    print(f"\n📊 FINAL NET PAY (Monthly):")
    print(f"  Gross After LOP:               ₹{result.gross_after_lop:>12,.2f}")
    if result.total_adjustments > 0:
        print(f"  + Adjustments:                 ₹{result.total_adjustments:>12,.2f}")
    print(f"  - Total Deductions:            ₹{result.total_deductions:>12,.2f}")
    print(f"  {'-'*45}")
    print(f"  NET PAY:                       ₹{result.net_pay:>12,.2f}")

    if result.previous_net_pay:
        print(f"\n📈 VARIANCE:")
        print(f"  Previous Month:                ₹{result.previous_net_pay:>12,.2f}")
        print(f"  Current Month:                 ₹{result.net_pay:>12,.2f}")
        print(f"  Difference:                    ₹{result.variance:>12,.2f}")

    print(f"\n" + "="*50 + "\n")

print("✅ Payroll calculation engine test complete!")
