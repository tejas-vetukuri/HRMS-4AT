import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.dev')
import django
django.setup()

from decimal import Decimal
from payroll.models import SalaryComponent, SalaryStructure, SalaryStructureComponent, PaySchedule, PayGroup
from employees.models import LegalEntity, Employee

# Get or create legal entity
legal_entity, _ = LegalEntity.objects.get_or_create(name='Default Company')

# Get or create pay schedule
from datetime import date
pay_schedule, _ = PaySchedule.objects.get_or_create(
    name='Monthly',
    defaults={
        'frequency': 'monthly',
        'pay_period_start_day': 1,
        'cutoff_day': 25,
        'pay_date_offset_days': 3,
        'first_cycle_start_date': date(2026, 1, 1),
    }
)

# Create components if they don't exist
components = {
    'Basic': SalaryComponent.objects.get_or_create(
        name='Basic',
        defaults={'component_type': 'earning', 'calculation_type': 'fixed', 'default_value': 20000}
    )[0],
    'HRA': SalaryComponent.objects.get_or_create(
        name='HRA',
        defaults={'component_type': 'earning', 'calculation_type': 'fixed', 'default_value': 10000}
    )[0],
    'Medical Allowance': SalaryComponent.objects.get_or_create(
        name='Medical Allowance',
        defaults={'component_type': 'earning', 'calculation_type': 'fixed', 'default_value': 5000}
    )[0],
    'Travel Allowance': SalaryComponent.objects.get_or_create(
        name='Travel Allowance',
        defaults={'component_type': 'earning', 'calculation_type': 'fixed', 'default_value': 2000}
    )[0],
    'Employer PF': SalaryComponent.objects.get_or_create(
        name='Employer PF',
        defaults={'component_type': 'deduction', 'calculation_type': 'fixed', 'default_value': 2400, 'is_statutory': True}
    )[0],
    'Employee PF': SalaryComponent.objects.get_or_create(
        name='Employee PF',
        defaults={'component_type': 'deduction', 'calculation_type': 'fixed', 'default_value': 2400, 'is_statutory': True}
    )[0],
}

# Create Salary Structures
structures = {
    'Stipend (15K-20K)': {'min': 15000, 'max': 20000, 'components': ['Basic', 'HRA']},
    'Standard (3L-5L)': {'min': 300000, 'max': 500000, 'components': ['Basic', 'HRA', 'Medical Allowance', 'Travel Allowance', 'Employer PF', 'Employee PF']},
}

for struct_name, config in structures.items():
    structure, created = SalaryStructure.objects.get_or_create(
        name=struct_name,
        legal_entity=legal_entity,
        defaults={'min_salary': config['min'], 'max_salary': config['max']}
    )
    if created:
        print(f'✅ Created structure: {struct_name}')
        # Add components
        for i, comp_name in enumerate(config['components']):
            SalaryStructureComponent.objects.get_or_create(
                structure=structure,
                component=components[comp_name],
                defaults={'order': i}
            )
        print(f'   Added {len(config["components"])} components')
    else:
        print(f'✓ Structure exists: {struct_name}')

# Create Pay Group
pay_group, created = PayGroup.objects.get_or_create(
    name='Standard Pay Group',
    legal_entity=legal_entity,
    defaults={
        'pay_schedule': pay_schedule,
        'maker_checker_enabled': True,
    }
)
if created:
    print(f'✅ Created pay group: Standard Pay Group')
else:
    print(f'✓ Pay group exists: Standard Pay Group')

print('\n✅ Salary structures seeded successfully!')
