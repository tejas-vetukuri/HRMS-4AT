from rest_framework.routers import DefaultRouter

from employees.views import (
    DepartmentViewSet,
    DesignationViewSet,
    EmployeeViewSet,
    LegalEntityViewSet,
    LocationViewSet,
)

router = DefaultRouter()
router.register("employees", EmployeeViewSet, basename="employee")
router.register("departments", DepartmentViewSet, basename="department")
router.register("designations", DesignationViewSet, basename="designation")
router.register("locations", LocationViewSet, basename="location")
router.register("legal-entities", LegalEntityViewSet, basename="legalentity")

urlpatterns = router.urls
