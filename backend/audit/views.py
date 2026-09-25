from django.db.models import Q
from rest_framework import viewsets

from audit.models import AuditLog
from audit.serializers import AuditLogSerializer
from core.permissions import HasPermissionCode


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """The activity log, newest first. Read-only: the log is append-only and
    nothing in the API can change or remove an entry.

    Filters (all optional, combinable): ?search= (action, record, or who did it),
    ?action=, ?entity_type=, ?entity_id= (with entity_type: the history of one
    record), ?actor= (a user id)."""

    serializer_class = AuditLogSerializer
    permission_classes = [HasPermissionCode]
    required_permission = "audit.read"

    def get_queryset(self):
        queryset = AuditLog.objects.select_related("actor").order_by("-id")
        params = self.request.query_params
        if params.get("action"):
            queryset = queryset.filter(action=params["action"])
        if params.get("entity_type"):
            queryset = queryset.filter(entity_type=params["entity_type"])
        if params.get("entity_id"):
            queryset = queryset.filter(entity_id=params["entity_id"])
        if params.get("actor"):
            queryset = queryset.filter(actor_id=params["actor"])
        search = params.get("search")
        if search:
            queryset = queryset.filter(
                Q(action__icontains=search)
                | Q(entity_type__icontains=search)
                | Q(entity_id__iexact=search)
                | Q(actor__email__icontains=search)
                | Q(actor__first_name__icontains=search)
                | Q(actor__last_name__icontains=search)
            )
        return queryset
