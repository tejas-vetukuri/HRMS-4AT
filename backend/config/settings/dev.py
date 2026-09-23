from .base import *  # noqa: F401,F403

DEBUG = True
# "testserver" is Django's own test-client host, not a real network name —
# harmless to allow here so manage.py shell / ad hoc scripts using
# django.test.Client work without a separate settings module. Any extra hosts
# from DJANGO_ALLOWED_HOSTS are appended (e.g. the "backend" service name when
# the frontend proxies to it over the docker-compose network).
import os as _os

ALLOWED_HOSTS = ["localhost", "127.0.0.1", "testserver"] + [
    h.strip() for h in _os.environ.get("DJANGO_ALLOWED_HOSTS", "").split(",") if h.strip()
]

# Local dev only: cookies over plain http don't work with Secure=True.
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False

# Reference plug-in module (see example_leave/). Never installed in production.
INSTALLED_APPS = [*INSTALLED_APPS, "example_leave"]  # noqa: F405
