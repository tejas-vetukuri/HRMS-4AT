import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.dev')
import django
django.setup()

from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from django.test import Client

User = get_user_model()
superadmin = User.objects.filter(email__icontains='superadmin').first()

if superadmin:
    refresh = RefreshToken.for_user(superadmin)
    access_token = str(refresh.access_token)

    client = Client()

    print("Testing Payroll Setup Endpoints:")
    print("=" * 60)

    endpoints = [
        ('/api/v1/payroll/setup/pay-groups/', 'Pay Groups'),
        ('/api/v1/payroll/setup/salary-structures/', 'Salary Structures'),
        ('/api/v1/payroll/inputs/compensation/?employee_id=12', 'Compensation for Employee 12'),
    ]

    for url, label in endpoints:
        response = client.get(
            url,
            HTTP_AUTHORIZATION=f'Bearer {access_token}'
        )
        print(f"\n{label}")
        print(f"URL: {url}")
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Success - {len(data.get('data', []))} items")
            if data.get('data'):
                print(f"   Sample: {str(data['data'][0])[:100]}")
        else:
            print(f"❌ Error:")
            print(response.content.decode()[:200])
else:
    print("No superadmin found")
