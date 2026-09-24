import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.dev')
import django
django.setup()

from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from django.test import Client
from payroll.models import SalaryStructure
import json

User = get_user_model()
superadmin = User.objects.filter(email__icontains='superadmin').first()
structure = SalaryStructure.objects.first()

if superadmin and structure:
    refresh = RefreshToken.for_user(superadmin)
    access_token = str(refresh.access_token)

    client = Client()

    url = f'/api/v1/payroll/setup/salary-structures/{structure.id}/'
    response = client.get(
        url,
        HTTP_AUTHORIZATION=f'Bearer {access_token}'
    )

    print(f"URL: {url}")
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print("\nResponse data:")
        print(json.dumps(data, indent=2)[:500])
        if 'data' in data and 'components' in data['data']:
            print(f"\n✅ Components in response: {len(data['data']['components'])}")
        else:
            print(f"\n❌ No components in response")
    else:
        print(response.content.decode()[:200])
