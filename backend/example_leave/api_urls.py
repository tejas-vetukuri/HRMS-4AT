"""Step 3: the routes. Mounted automatically under /api/v1/ (config/api_urls.py)."""

from rest_framework.routers import DefaultRouter

from example_leave.views import LeaveRequestViewSet

router = DefaultRouter()
router.register("example-leave/requests", LeaveRequestViewSet, basename="example-leave-request")

urlpatterns = router.urls
