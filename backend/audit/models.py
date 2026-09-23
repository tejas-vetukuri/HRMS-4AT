"""docs/ARCHITECTURE.md primitive #4 — the append-only audit log. No update or
delete path is exposed anywhere in this app, not even via Django admin (see
audit/admin.py) — every other module writes to it only through write_audit()
(audit/service.py), never by touching the model directly."""

from django.conf import settings
from django.db import models


class AuditLog(models.Model):
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="audit_logs",
        help_text="Null for unauthenticated events (e.g. a failed login attempt).",
    )
    action = models.CharField(max_length=100, help_text="e.g. 'auth.login_succeeded'")
    entity_type = models.CharField(max_length=100, help_text="e.g. 'User', 'RolePermission'")
    entity_id = models.CharField(max_length=50, blank=True)
    diff = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["entity_type", "entity_id"]),
            models.Index(fields=["action"]),
        ]

    def __str__(self):
        return f"{self.created_at:%Y-%m-%d %H:%M:%S} {self.action} by {self.actor_id}"
