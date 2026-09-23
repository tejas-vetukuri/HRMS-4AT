from django.contrib import admin

from employees.models import (
    BusinessUnit,
    CostCenter,
    Department,
    Designation,
    Employee,
    LegalEntity,
    Location,
)

admin.site.register(Department)
admin.site.register(Designation)
admin.site.register(Location)
admin.site.register(LegalEntity)
admin.site.register(BusinessUnit)
admin.site.register(CostCenter)


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ["employee_code", "user", "manager", "department", "status"]
    search_fields = ["employee_code", "user__username", "user__email"]
    list_filter = ["status", "department", "location", "legal_entity", "business_unit"]
