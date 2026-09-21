from django.apps import AppConfig
from django.db.models.signals import post_migrate
from django.utils.module_loading import autodiscover_modules


def _sync_permissions(sender, **kwargs):
    # post_migrate fires once per app; syncing on accounts (the app that owns
    # the Permission tables) is enough, and the tables are guaranteed to exist.
    if sender.name != "accounts":
        return
    from core.registry import sync_registered_permissions

    sync_registered_permissions()


class CoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "core"

    def ready(self):
        from core import checks  # noqa: F401  (registers the startup checks)

        # Every installed app may declare its permissions in `<app>/rbac.py`.
        autodiscover_modules("rbac")
        post_migrate.connect(_sync_permissions, dispatch_uid="core.sync_registered_permissions")
