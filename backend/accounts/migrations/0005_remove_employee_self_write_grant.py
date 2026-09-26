from django.db import migrations


def remove_self_write(apps, schema_editor):
    """The starter seed gave the Employee role `employees.write` at the `self`
    tier. Now that employees.write guards the directory write endpoints, that
    would let anyone edit their own manager, department and status. Profile
    self-service belongs to its own permission, not this one."""
    RolePermission = apps.get_model("accounts", "RolePermission")
    RolePermission.objects.filter(
        role__name="Employee", permission__code="employees.write", scope_tier="self"
    ).delete()


class Migration(migrations.Migration):
    dependencies = [("accounts", "0004_alter_role_archetype_failedloginattempt")]
    operations = [migrations.RunPython(remove_self_write, migrations.RunPython.noop)]
