"""The primitive's public surface: two direct function calls other modules
invoke at their own trigger points (docs/ARCHITECTURE.md #5). No broker, no
pub/sub — a module that approves leave calls notify(...) right there."""

import logging

from django.conf import settings
from django.core.mail import send_mail

from .models import Notification

logger = logging.getLogger(__name__)


def notify(user, type: str, title: str, body: str | None = None) -> Notification:
    """Create an in-app notification for `user`. Returns the row."""
    return Notification.objects.create(user=user, type=type, title=title, body=body)


def send_email(to: str, subject: str, body: str) -> bool:
    """Best-effort transactional email. Never raises into the caller's flow — a
    failed email must not roll back the business action that triggered it; it is
    logged instead. In dev EMAIL_BACKEND is the console backend."""
    try:
        send_mail(
            subject,
            body,
            getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@hrms.local"),
            [to],
            fail_silently=False,
        )
        return True
    except Exception:  # noqa: BLE001 — email must never break the caller
        logger.exception("send_email to %s failed", to)
        return False
