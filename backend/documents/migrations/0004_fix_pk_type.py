"""State-only migration: tell Django the Document pk is BigAutoField (bigint),
matching the actual DB column type from the ZIP's schema. No database changes
are needed — the column is already bigint."""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("documents", "0003_fix_missing_columns"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AlterField(
                    model_name="document",
                    name="id",
                    field=models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                )
            ],
            database_operations=[],  # DB already has bigint — nothing to change.
        )
    ]
