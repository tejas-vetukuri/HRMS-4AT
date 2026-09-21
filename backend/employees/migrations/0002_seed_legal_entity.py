"""Seed exactly one LegalEntity row. The company operates as a single legal
entity today (docs/REQUIREMENTS.md §0) — this seed exists so employees.legal_entity
is always populatable from day one, not to model multiple entities yet. Rename
this row (or add more) later via the LegalEntity CRUD that lands in Phase 2.
Idempotent/re-runnable: get_or_create by name, safe in dev/CI/staging/prod alike.
"""

from django.db import migrations

DEFAULT_LEGAL_ENTITY_NAME = "Default Entity"


def seed_default_legal_entity(apps, schema_editor):
    LegalEntity = apps.get_model("employees", "LegalEntity")
    LegalEntity.objects.get_or_create(
        name=DEFAULT_LEGAL_ENTITY_NAME, defaults={"is_active": True}
    )


def unseed_default_legal_entity(apps, schema_editor):
    LegalEntity = apps.get_model("employees", "LegalEntity")
    LegalEntity.objects.filter(name=DEFAULT_LEGAL_ENTITY_NAME).delete()


class Migration(migrations.Migration):
    dependencies = [("employees", "0001_initial")]

    operations = [
        migrations.RunPython(seed_default_legal_entity, unseed_default_legal_entity),
    ]
