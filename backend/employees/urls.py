from django.urls import re_path
from rest_framework.routers import DefaultRouter

from employees.views import (
    BusinessUnitAdminViewSet,
    BusinessUnitViewSet,
    CostCenterAdminViewSet,
    CostCenterViewSet,
    DepartmentAdminViewSet,
    DepartmentViewSet,
    DesignationAdminViewSet,
    DesignationViewSet,
    EmployeeViewSet,
    EssProfileView,
    LegalEntityAdminViewSet,
    LegalEntityViewSet,
    LocationAdminViewSet,
    LocationViewSet,
    OrgDirectoryViewSet,
)

router = DefaultRouter()
router.register("employees", EmployeeViewSet, basename="employee")
# Company-wide org directory (unscoped, read-only) — powers the Organisation
# page's chart/directory for every user, regardless of RBAC scope.
router.register("org-directory", OrgDirectoryViewSet, basename="org-directory")

# Read-only lists the frontend pages call ({success, data}, snake_case).
router.register("departments", DepartmentViewSet, basename="department")
router.register("designations", DesignationViewSet, basename="designation")
router.register("locations", LocationViewSet, basename="location")
router.register("legal-entities", LegalEntityViewSet, basename="legalentity")
router.register("business-units", BusinessUnitViewSet, basename="businessunit")
router.register("cost-centers", CostCenterViewSet, basename="costcenter")

# Managing the structure (org.manage; camelCase, paginated, audited).
router.register("org/departments", DepartmentAdminViewSet, basename="org-department")
router.register("org/designations", DesignationAdminViewSet, basename="org-designation")
router.register("org/locations", LocationAdminViewSet, basename="org-location")
router.register("org/legal-entities", LegalEntityAdminViewSet, basename="org-legalentity")
router.register("org/business-units", BusinessUnitAdminViewSet, basename="org-businessunit")
router.register("org/cost-centers", CostCenterAdminViewSet, basename="org-costcenter")

urlpatterns = [
    # The frontend calls this without a trailing slash.
    re_path(r"^ess/profile/?$", EssProfileView.as_view(), name="ess-profile"),
    *router.urls,
]
