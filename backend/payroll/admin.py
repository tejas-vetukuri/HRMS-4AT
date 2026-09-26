from django.apps import apps
from django.contrib import admin
from django.contrib.admin.sites import AlreadyRegistered

for _model in apps.get_app_config("payroll").get_models():
    try:
        admin.site.register(_model)
    except AlreadyRegistered:
        pass
