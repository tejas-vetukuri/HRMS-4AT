import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.dev')
import django
django.setup()

from employees.models import LegalEntity, Employee
from payroll.models import PayrollPeriod
from payroll.calculation_engine import PayrollCalculationEngine
import json

legal_entity = LegalEntity.objects.get(name='Default Company')
period = PayrollPeriod.objects.filter(legal_entity=legal_entity).first()
employee = Employee.objects.filter(legal_entity=legal_entity, payroll_status__is_payroll_enabled=True).first()

if not employee:
    print("No payroll-enabled employee found")
    exit(1)

print(f"Testing Payroll Calculation Engine")
print(f"================================")
print(f"Period: {period.month}/{period.year}")
print(f"Employee: {employee.id}")

# Run calculation
engine = PayrollCalculationEngine(employee, period)
result = engine.calculate()

if 'error' in result:
    print(f"❌ Error: {result['error']}")
else:
    print(f"\n✅ Calculation successful!\n")
    print("Earnings:")
    print(json.dumps(result['earnings'], indent=2, default=str))
    print("\nDeductions:")
    print(json.dumps(result['deductions'], indent=2, default=str))
    print("\nTotals:")
    print(json.dumps(result['totals'], indent=2, default=str))
