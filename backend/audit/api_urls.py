from rest_framework.routers import DefaultRouter

from audit.views import AuditLogViewSet

router = DefaultRouter()
router.register("audit-log", AuditLogViewSet, basename="audit-log")

urlpatterns = router.urls
