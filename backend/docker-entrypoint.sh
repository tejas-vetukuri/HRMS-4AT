#!/usr/bin/env bash
# Backend container entrypoint: wait for Postgres, migrate, seed, then serve.
set -e

echo "==> Waiting for Postgres at ${POSTGRES_HOST}:${POSTGRES_PORT}"
until python -c "import socket,os; s=socket.socket(); s.settimeout(2); s.connect((os.environ['POSTGRES_HOST'], int(os.environ['POSTGRES_PORT'])))" 2>/dev/null; do
  sleep 1
done

echo "==> Migrating and seeding"
python manage.py migrate --noinput
python manage.py createinitialadmin || true
python manage.py seed_demo_org || true

echo "==> Starting Django on :3000"
exec python manage.py runserver 0.0.0.0:3000
