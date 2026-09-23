"""Self-scoped notification endpoints — every caller sees and mutates only their
own notifications, so the guard is IsAuthenticated + a queryset filtered to
request.user (no RBAC employee-scope: a notification is owned by a user, not
keyed to an employee). Responses use the {success, data} envelope the frontend
notifications client reads; the project's camelCase renderer converts field
names."""

from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification
from .serializers import NotificationSerializer


def _mine(request):
    return Notification.objects.filter(user=request.user)


class NotificationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            limit = min(max(int(request.query_params.get("limit", 20)), 1), 100)
        except (TypeError, ValueError):
            limit = 20
        queryset = _mine(request)
        unread = queryset.filter(read_at__isnull=True).count()
        data = NotificationSerializer(queryset[:limit], many=True).data
        return Response({"success": True, "data": {"notifications": data, "unreadCount": unread}})


class NotificationReadView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request, pk):
        notification = _mine(request).filter(pk=pk).first()
        if notification is None:
            return Response(
                {"success": False, "error": {"message": "Notification not found."}}, status=404
            )
        if notification.read_at is None:
            notification.read_at = timezone.now()
            notification.save(update_fields=["read_at"])
        return Response(
            {"success": True, "data": {"notification": NotificationSerializer(notification).data}}
        )


class NotificationReadAllView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request):
        marked = _mine(request).filter(read_at__isnull=True).update(read_at=timezone.now())
        return Response({"success": True, "data": {"markedCount": marked}})
