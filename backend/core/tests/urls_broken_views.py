"""Deliberately mis-wired views, used only to prove core.checks catches each mistake."""

from django.urls import include, path
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.routers import DefaultRouter

from core.permissions import HasPermissionCode, ScopedEmployeePermission


class TypoCodeViewSet(viewsets.ViewSet):
    permission_classes = [HasPermissionCode]
    required_permission = "employees.raed"  # typo of employees.read

    def list(self, request):
        return Response([])


class MissingCodeViewSet(viewsets.ViewSet):
    permission_classes = [ScopedEmployeePermission]

    def list(self, request):
        return Response([])


class UnmappedActionViewSet(viewsets.ViewSet):
    permission_classes = [ScopedEmployeePermission]
    required_permission = "employees.read"

    def list(self, request):
        return Response([])

    @action(detail=False, methods=["post"])
    def approve(self, request):
        return Response({})


class UnregisteredActionCodeViewSet(viewsets.ViewSet):
    permission_classes = [ScopedEmployeePermission]
    required_permission = "employees.read"
    action_permissions = {"approve": "leaves.approve"}  # module never registered it

    def list(self, request):
        return Response([])

    @action(detail=False, methods=["post"])
    def approve(self, request):
        return Response({})


class WriteWithoutPermissionViewSet(viewsets.ViewSet):
    permission_classes = [ScopedEmployeePermission]
    required_permission = "employees.read"

    def list(self, request):
        return Response([])

    def create(self, request):
        return Response({})


class CorrectViewSet(viewsets.ViewSet):
    permission_classes = [ScopedEmployeePermission]
    required_permission = "employees.read"
    action_permissions = {"approve": "employees.write"}

    def list(self, request):
        return Response([])

    @action(detail=False, methods=["post"])
    def approve(self, request):
        return Response({})


router = DefaultRouter()
router.register("typo", TypoCodeViewSet, basename="typo")
router.register("missing", MissingCodeViewSet, basename="missing")
router.register("unmapped", UnmappedActionViewSet, basename="unmapped")
router.register("unregistered", UnregisteredActionCodeViewSet, basename="unregistered")
router.register("writes", WriteWithoutPermissionViewSet, basename="writes")
router.register("correct", CorrectViewSet, basename="correct")

urlpatterns = [path("api/", include(router.urls))]
