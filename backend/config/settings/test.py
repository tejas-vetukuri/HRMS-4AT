from .base import *  # noqa: F401,F403

DEBUG = False

# Real Postgres, no sqlite shortcuts — see docs/DEVELOPMENT.md. Connection details
# come from the same POSTGRES_* env vars as dev.py, however that Postgres instance
# is provisioned (local install, CI service container, etc. — not decided yet).

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",  # fast hashing in tests only
]
