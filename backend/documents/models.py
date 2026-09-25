"""Primitive #6 — File storage (docs/ARCHITECTURE.md). One `Document` row per
stored file, attached to some entity by (entity_type, entity_id). The row IS the
abstraction — access is derived from a per-entity_type matrix (see access.py),
not from a storage interface layer. Bytes live on disk (MEDIA_ROOT) now; swapping
to S3 later is a storage-backend change, not a schema change."""

import uuid

from django.conf import settings
from django.db import models


def _upload_to(instance, filename):
    return f"documents/{instance.entity_type}/{uuid.uuid4()}/{filename}"


class Document(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # What this file is attached to, e.g. ("payslip", <employee id>).
    entity_type = models.CharField(max_length=64)
    entity_id = models.CharField(max_length=64)
    file = models.FileField(upload_to=_upload_to)
    original_name = models.CharField(max_length=255)
    content_type = models.CharField(max_length=127, blank=True)
    size = models.PositiveBigIntegerField(default=0)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+"
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-uploaded_at"]
        indexes = [models.Index(fields=["entity_type", "entity_id"])]

    def __str__(self):
        return f"{self.entity_type}:{self.entity_id}/{self.original_name}"
