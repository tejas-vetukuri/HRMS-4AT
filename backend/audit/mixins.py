"""AuditedModelViewSet — write_audit() wired into create/update/destroy so
every module gets an audit trail on its mutations without hand-rolling the
same before/after diff logic each time (docs/ARCHITECTURE.md primitive #4).
Subclasses just set `audit_entity_type`.

Diffs are stored camelCase (via the same camelize() the response renderer
uses) rather than raw serializer.data's snake_case — an admin reading the
audit log is reading it next to API responses/request payloads that are all
camelCase, and a diff in a different case convention from everything else
they're looking at is just friction."""

from djangorestframework_camel_case.util import camelize
from rest_framework import viewsets

from audit.service import write_audit


class AuditedModelViewSet(viewsets.ModelViewSet):
    audit_entity_type: str = ""

    def perform_create(self, serializer):
        serializer.save()
        write_audit(
            self.request.user,
            f"{self.audit_entity_type}.created",
            self.audit_entity_type,
            serializer.instance.pk,
            {"after": camelize(serializer.data)},
        )

    def perform_update(self, serializer):
        before = self.get_serializer(serializer.instance).data
        serializer.save()
        write_audit(
            self.request.user,
            f"{self.audit_entity_type}.updated",
            self.audit_entity_type,
            serializer.instance.pk,
            {"before": camelize(before), "after": camelize(serializer.data)},
        )

    def perform_destroy(self, instance):
        before = self.get_serializer(instance).data
        entity_id = instance.pk
        instance.delete()
        write_audit(
            self.request.user,
            f"{self.audit_entity_type}.deleted",
            self.audit_entity_type,
            entity_id,
            {"before": camelize(before)},
        )
