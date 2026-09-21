"""write_audit() — the one function every other module calls directly
(docs/ARCHITECTURE.md primitive #4: a direct call, not an event bus). Design
it generic enough that Phase 2+ modules don't each need their own variant:
actor/action/entity_type/entity_id/diff covers "who did what to which row,
and what changed" for anything in the system."""

from django.contrib.auth import get_user_model

from audit.models import AuditLog


def write_audit(actor, action: str, entity_type: str, entity_id=None, diff: dict | None = None):
    User = get_user_model()
    if actor is not None and not isinstance(actor, User):
        actor = None
    elif actor is not None and not getattr(actor, "is_authenticated", True):
        actor = None

    return AuditLog.objects.create(
        actor=actor,
        action=action,
        entity_type=entity_type,
        entity_id="" if entity_id is None else str(entity_id),
        diff=diff or {},
    )
