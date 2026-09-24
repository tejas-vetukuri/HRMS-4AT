import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.dev')
import django
django.setup()

from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from django.test import Client
import json

User = get_user_model()
superadmin = User.objects.filter(email__icontains='superadmin').first()

if superadmin:
    refresh = RefreshToken.for_user(superadmin)
    access_token = str(refresh.access_token)

    client = Client()

    endpoints = [
        '/api/v1/payroll/setup/pay-groups/',
        '/api/v1/payroll/setup/salary-structures/',
        '/api/v1/payroll/inputs/compensation/?employee_id=1',
    ]

    for url in endpoints:
        response = client.get(url, HTTP_AUTHORIZATION=f'Bearer {access_token}')
        print(f"GET {url}: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"  ✅ Data returned: {len(data.get('data', []))} items\n")
        else:
            print(f"  ❌ Error: {response.content.decode()[:150]}\n")
