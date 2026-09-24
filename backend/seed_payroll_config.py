"""
Seed payroll calculation engine configuration.
"""
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.dev')
import django
django.setup()

from decimal import Decimal
from datetime import date
from employees.models import LegalEntity
from payroll.models import (
    LopConfiguration, PfRule, PtSlab, TdsConfiguration,
    PayrollPeriod
)

# Get or create legal entity
legal_entity, _ = LegalEntity.objects.get_or_create(name='Default Company')

# ===== LOP Configuration =====
lop_config, created = LopConfiguration.objects.get_or_create(
    legal_entity=legal_entity,
    defaults={
        'day_basis': 'fixed_30',
    }
)
if created:
    print('✅ Created LOP Configuration (30-day basis)')
else:
    print('✓ LOP Configuration exists')

# ===== PF Rule =====
pf_rule, created = PfRule.objects.get_or_create(
    legal_entity=legal_entity,
    defaults={
        'employee_pf_rate': Decimal('12.0'),
        'employer_pf_rate': Decimal('12.0'),
        'pf_wage_ceiling': Decimal('15000.00'),  # PF calculated on min(basic, 15000)
        'pf_basis': 'basic',
        'is_mandatory': True,
        'effective_from': date.today(),
    }
)
if created:
    print('✅ Created PF Rule (12% employee, 12% employer, ₹15k ceiling)')
else:
    print('✓ PF Rule exists')

# ===== PT Slabs =====
pt_slabs_config = [
    {'salary_from': 0, 'salary_to': 100000, 'pt_amount': 0},
    {'salary_from': 100000, 'salary_to': 500000, 'pt_amount': 150},
    {'salary_from': 500000, 'salary_to': 1000000, 'pt_amount': 200},
    {'salary_from': 1000000, 'salary_to': None, 'pt_amount': 300},
]

for slab_config in pt_slabs_config:
    pt_slab, created = PtSlab.objects.get_or_create(
        legal_entity=legal_entity,
        salary_from=Decimal(str(slab_config['salary_from'])),
        salary_to=Decimal(str(slab_config['salary_to'])) if slab_config['salary_to'] else None,
        effective_from=date.today(),
        defaults={
            'pt_amount': Decimal(str(slab_config['pt_amount'])),
        }
    )
    if created:
        to_str = str(slab_config['salary_to']) if slab_config['salary_to'] else 'above'
        print(f'✅ Created PT Slab: ₹{slab_config["salary_from"]} - {to_str} = ₹{slab_config["pt_amount"]}')

# ===== TDS Configuration =====
tds_config, created = TdsConfiguration.objects.get_or_create(
    legal_entity=legal_entity,
    defaults={
        'tax_regime': 'new',
        'financial_year': '2024-25',
        'tds_rules': {
            'basic_exemption': 300000,
            'slab_rate': 0.03,  # 3% for now, replace with actual slabs
        },
        'effective_from': date.today(),
    }
)
if created:
    print('✅ Created TDS Configuration (New Regime)')
else:
    print('✓ TDS Configuration exists')

# ===== Create Current Payroll Period =====
import calendar
today = date.today()
year, month = today.year, today.month
days_in_month = calendar.monthrange(year, month)[1]
period_start = date(year, month, 1)
period_end = date(year, month, days_in_month)

# Count working days (approximate: 22-23 per month)
working_days = (period_end.weekday() - period_start.weekday() + 1) % 7
if working_days == 0:
    working_days = 22
else:
    working_days = (days_in_month // 7) * 5 + min(5, days_in_month % 7)

payroll_period, created = PayrollPeriod.objects.get_or_create(
    legal_entity=legal_entity,
    year=year,
    month=month,
    defaults={
        'start_date': period_start,
        'end_date': period_end,
        'working_days': working_days,
    }
)
if created:
    print(f'✅ Created Payroll Period: {month}/{year} ({working_days} working days)')
else:
    print(f'✓ Payroll Period exists: {month}/{year}')

print('\n✅ Payroll configuration seeded successfully!')
