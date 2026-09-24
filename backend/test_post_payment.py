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

    payload = {
        "employee_id": "12",
        "payment_method": "direct_deposit",
        "bank_name": "Test Bank",
        "bank_account_number": "123456789",
        "bank_ifsc_code": "TESTIFSC",
        "bank_account_holder_name": "Test Name"
    }

    response = client.post(
        '/api/v1/payroll/inputs/payment-info/',
        data=json.dumps(payload),
        content_type='application/json',
        HTTP_AUTHORIZATION=f'Bearer {access_token}'
    )

    print(f"Status: {response.status_code}")
    if response.status_code in [200, 201]:
        print(f"✅ Success!")
    else:
        print(f"❌ Error:")
        print(response.content.decode())
else:
    print("No superadmin found")
