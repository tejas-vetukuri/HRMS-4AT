from .base import *  # noqa: F401,F403

DEBUG = True
# "testserver" is Django's own test-client host, not a real network name —
# harmless to allow here so manage.py shell / ad hoc scripts using
# django.test.Client work without a separate settings module.
ALLOWED_HOSTS = ["localhost", "127.0.0.1", "testserver"]

# Local dev only: cookies over plain http don't work with Secure=True.
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
