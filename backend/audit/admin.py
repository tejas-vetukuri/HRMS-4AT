from django.contrib import admin

from audit.models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    """Read-only, deliberately — append-only means no admin edit/delete path
    either, not just no API one."""

    list_display = ["created_at", "actor", "action", "entity_type", "entity_id"]
    list_filter = ["action", "entity_type"]
    search_fields = ["entity_id", "actor__email"]
    readonly_fields = ["actor", "action", "entity_type", "entity_id", "diff", "created_at"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
