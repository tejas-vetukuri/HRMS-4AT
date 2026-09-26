"""Session management — the one RBAC-engine subtask not covered by the
original 9-step build sequence: enumerate a user's active refresh tokens
("sessions") and revoke them, either self-service or as an admin
force-logout. Built directly on djangorestframework-simplejwt's
token_blacklist app (OutstandingToken/BlacklistedToken) rather than a new
model — a "session" here just is an issued, unexpired, unrevoked refresh
token; there is no separate session concept to invent.

Deliberately no "is this the current session" flag: the access token used to
authenticate this request and the refresh token that issued it don't share a
jti by default, so which OutstandingToken row corresponds to "this request"
can't be determined reliably without changing the token claims."""

from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from audit.service import write_audit


class SessionSerializer(serializers.ModelSerializer):
    is_revoked = serializers.SerializerMethodField()

    class Meta:
        model = OutstandingToken
        fields = ["id", "created_at", "expires_at", "is_revoked"]

    def get_is_revoked(self, obj):
        return BlacklistedToken.objects.filter(token=obj).exists()


def _active_sessions(user):
    return (
        OutstandingToken.objects.filter(user=user, expires_at__gt=timezone.now())
        .exclude(blacklistedtoken__isnull=False)
        .order_by("-created_at")
    )


class MySessionsView(APIView):
    """GET /users/me/sessions — the authenticated user's own active sessions."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        sessions = _active_sessions(request.user)
        return Response({"success": True, "data": SessionSerializer(sessions, many=True).data})


class MySessionDetailView(APIView):
    """DELETE /users/me/sessions/{id} — revoke one of the caller's own
    sessions (e.g. "log out that other device"). Scoped to the caller's own
    OutstandingToken rows — this is not how an admin force-logs-out someone
    else; that's UserViewSet.revoke_sessions (accounts/views.py)."""

    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        token = OutstandingToken.objects.filter(pk=pk, user=request.user).first()
        if token is None:
            return Response(
                {"success": False, "error": {"code": "NOT_FOUND", "message": "No such session."}},
                status=status.HTTP_404_NOT_FOUND,
            )

        BlacklistedToken.objects.get_or_create(token=token)
        write_audit(request.user, "auth.session_revoked", "User", request.user.pk, {"tokenId": pk})
        return Response(status=status.HTTP_204_NO_CONTENT)
