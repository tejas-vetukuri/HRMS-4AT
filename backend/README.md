# Backend

Django + DRF backend described in
[`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) and
[`../docs/IMPLEMENTATION-PLAN.md`](../docs/IMPLEMENTATION-PLAN.md).

## Implemented so far

Core primitives **#1 (Employee/org table)** and **#2 (RBAC + scope resolver)** —
see the primitives table in [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md):

- `employees/` — `Employee` (self-FK `manager`, `status` enum), `Department`,
  `Designation`, `Location`, `LegalEntity` (seeded with exactly one row).
- `accounts/` — custom `User` (direct FK to `Role`), `Role` (admin-creatable,
  4 starter roles seeded), `Permission`, `RolePermission` (scope tier per
  role+permission), `UserPermissionOverride` (per-individual grants/denials).
- `core/scope.py::resolve_employee_scope(user, permission_code)` — resolves all
  7 scope tiers (`self`/`manager`/`team`/`department`/`location`/`legal_entity`/
  `all`); `team` uses a recursive CTE over the `manager` self-FK.
  `core/scope.py::user_has_permission(user, permission_code)` — flat yes/no check
  for non-employee-keyed capability permissions (e.g. `roles.manage`).
  `core/permissions.py` — the two DRF permission classes views use to enforce
  both of the above. Covered by `core/tests/test_scope.py` (13 tests: every
  tier, override precedence, explicit deny).

**API surface** (mounted at `/api/v1/`, camelCase in/out via
`djangorestframework-camel-case`, pagination as `{results, total, page,
pageSize}` — **except the employee directory, see below**):

- **Employee directory** — `/employees/` (list is scope-filtered via
  `employees.read`; retrieve on an out-of-scope employee is a 403, not a
  filtered-away 404), `/departments/`, `/designations/`, `/locations/`,
  `/legal-entities/` (read-only reference lists). **Deliberately breaks the
  camelCase/paginated convention** — verified live against the actual
  frontend (`employees/page.tsx`, `org/page.tsx`, `profile/page.tsx`), not
  assumed from docs: these three pages read `{success, data}` with
  snake_case fields and a bare array, not `{results, total, ...}`. See
  `employees/views.py::FrontendEnvelopeMixin`. This was caught by actually
  running the frontend against the backend end-to-end (log in as a demo
  user, hit `/employees`) — the network calls returned 200 with correct data
  and the page still rendered "Request failed," because the shape didn't
  match what the page's own code expected. Confirmed fixed the same way:
  logged in as `demo.hradmin@hrms.local`, the Organization page renders all
  97 real employees; logged in as `demo.employee@hrms.local`, the page is
  absent from nav and direct navigation to `/employees` redirects home.
- **RBAC management**, gated behind `roles.manage`, every write audited
  (`audit/mixins.py::AuditedModelViewSet`) — `/roles/` (full CRUD, read-only
  nested `permissions`), `/permissions/` (read-only — codes are declared in
  code, not admin-creatable), `/role-permissions/` (grant/revoke a permission
  on a role at a scope tier; `?role=<id>` filters), `/user-permission-overrides/`
  (per-individual grant/deny; `?user=<id>` filters), `/users/` (the missing
  link: assigns a `Role` to a `User` — without this, custom roles/permissions
  are inert since nobody could ever actually be given one; `?search=` by
  name/email; `POST /users/{id}/reset-password/` — admin-driven reset,
  returns a one-time temporary password, audited without ever logging the
  password itself).

**Auth** — `POST /auth/login` (`{email,password}` → user + JWT pair, IP-rate-
limited via `throttle_scope="login"`, per-account lockout after 5 failures in
15 minutes via `FailedLoginAttempt` — two separate defenses for two separate
threats), `POST /auth/refresh` (rotates, blacklists the old token), `POST
/auth/logout` (blacklists), `GET`/`PATCH /users/me` (returns `roles:
[{name, archetype}]`, `permissions`, and the `scope` field the frontend's
`ManagementScope` actually consumes — see `accounts/auth_views.py`'s
docstring for where the contract docs had drifted from the real frontend
code). Every auth event (login success/failure/lockout, logout, refresh,
profile update) is audited. `python manage.py createinitialadmin` (reads
`INITIAL_ADMIN_EMAIL`/`INITIAL_ADMIN_PASSWORD`, idempotent — the real
production bootstrap) and `python manage.py seed_demo_users` (one login per
starter role, password `DemoPass123!`, disposable test fixtures) are both
available.

**Audit** — `audit.AuditLog`, strictly append-only (no update/delete path
anywhere, not even in `/admin/`), written via `audit/service.py::write_audit()`.
Wired into every auth event and every RBAC mutation. Diffs are stored
camelCase to match everything else in the API, not raw Python snake_case.

**Session management** — `GET /users/me/sessions` (a user's own active
refresh tokens), `DELETE /users/me/sessions/{id}` (revoke one, e.g. "log out
that other device" — 404s on someone else's session rather than leaking that
it exists), `POST /users/{id}/revoke-sessions/` (admin force-logout,
`roles.manage`, audited). Built directly on `djangorestframework-simplejwt`'s
`OutstandingToken`/`BlacklistedToken` — a session is just an issued,
unexpired, unrevoked refresh token; there's no separate session model.

The RBAC engine — Employee/org model, roles/permissions, scope resolution,
enforcement, authentication, admin tooling, per-individual overrides, auth
hardening, audit logging, session management, and role assignment against
the real employee population — is functionally complete, covered by 103
automated tests (unit + full API-level 200/403 matrices) running against
real Postgres — `pytest` in `backend/`. Nothing outside this scope has been
built: no plugin module (Attendance, Leave, Payroll, ...) exists in the
codebase yet, by design — see the "seven primitives" note in
[`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md). The one item on this
list that hasn't happened is independent review: the scope-resolution and
authentication logic requires sign-off from someone other than its author
before it's relied on for production access decisions.

**Not yet built:** notifications, documents, and every plugin module
(Attendance, Leave, Payroll, ...). See [`../docs/TASKS.md`](../docs/TASKS.md)
for the full task breakdown — Phase 0's CI/lint/backup scaffolding hasn't
landed yet. Also still open: 28 real employees have no manager (27 collapsed in the
org chart plus the root), no directory write endpoints exist yet, and only the 4
demo accounts can log in (the 93 real employees have unusable passwords).

## Building a module on top of RBAC and the directory

Verified by writing a stand-in module (a leave-request app) against these
interfaces and testing it end to end — not just documented. What a module
author does:

1. **Register permission codes** in a data migration of your app that
   depends on `("accounts", "0004_...")` (create `Permission` rows, then
   `RolePermission` grants with a scope tier per role). There is no
   registration helper yet.
2. **FK to `employees.Employee`** named `employee` on any employee-keyed model
   (`ScopedEmployeePermission` scope-checks via `obj.employee_id`).
3. **View:** `permission_classes = [ScopedEmployeePermission]`,
   `required_permission = "leave.read"`, and filter list querysets with
   `resolve_employee_scope(user, code)`. **Every custom `@action` must be
   mapped**: `action_permissions = {"approve": "leave.approve"}`. Unmapped
   custom actions raise `ImproperlyConfigured` rather than being authorised
   by the read permission (without this, an Employee holding only
   `leave.read` could approve their own request).
4. Derive the employee from `request.user.employee` on create, never from the
   request body; call `audit.service.write_audit(...)` on every mutation.
5. **Ship a `verify_<module>` command** (next section) so the module's access
   rules can be watched working, not just trusted from a passing test run.

## Live verification (required for every module and change)

Results have to be visible, not only asserted. Each module ships a management
command that builds a small fictional company, logs in as each person through the
real API against the real Postgres, and prints every request and every check as
it happens. The run is wrapped in a transaction and rolled back, so it is safe
against the dev database, and it exits non-zero on any failure so CI can run it.

```bash
python manage.py verify_rbac
```

`verify_rbac` currently runs 64 checks in about three seconds: authentication
(wrong password, replayed refresh token, lockout, throttling), directory
visibility under the four starter roles, custom roles created live at every scope
tier (team, department, location, legal entity), per-individual grant and deny
overrides, who may administer roles, session revocation and deactivation, and the
audit trail those actions leave. Sample of the output:

```
== 3. Custom roles and every scope tier, created at runtime by an admin
     hana     POST   /api/v1/roles/  ->  201
   PASS  admin creates custom role 'VFY team reader'
     dana     GET    /api/v1/employees/  ->  200  (4 rows)
   sees: Dana, Eli, Eve, Maya
   PASS  Dana now sees exactly the 'team' population
```

To add one for a new module, subclass `core.verification.VerificationCommand`
and implement `verify(self, v)`; the harness provides `v.login(...)` (a real
`/auth/login`), request tracing, `v.expect(...)`/`v.check(...)`, the rollback and
the exit code. See `accounts/management/commands/verify_rbac.py` as the worked
example, and `accounts/tests/test_verify_rbac.py` for how to prove the command
fails when the behaviour it checks is broken (a verification that cannot fail
proves nothing). Output never echoes response bodies, since the dev database may
hold real employee data.

Not yet shared: the `{success, data}` snake_case response wrapper the
directory pages need lives in `employees/views.py::FrontendEnvelopeMixin`;
each module's frontend pages define their own expected shape, so check the
page source, not the docs.

## Real employee data — this repo is public

**Never commit real names, emails, or org data.** `.gitignore` excludes
`backend/**/management/commands/data/` for exactly this reason — a loader
script (e.g. `accounts/management/commands/import_employee_directory.py`) is
tracked; the data file it reads is not, and never should be. The actual
roster lives in a private location outside this repo (ask whoever ran the
import most recently where that currently is — a private sheet/gist/HR
export, not fixed infrastructure); to re-run an import, fetch the current
file from there and drop it at the path the command expects, run the
command, then leave the file in place locally (gitignored) or delete it —
either is fine, just never `git add -f` it.

## Postgres

Local Postgres runs as a **dedicated dev-only cluster in `backend/.pgdata`**,
not the machine's system-wide Postgres service (this machine happens to have
one installed at `C:\Program Files\PostgreSQL\17`, running as a Windows
service on port 5432 — deliberately left untouched: resetting its superuser
password would have meant weakening its auth, even temporarily). This
project's cluster reuses the same PostgreSQL 17 binaries but is a separate,
isolated data directory on **port 5433**, with its own `hrms`
superuser/password set at `initdb` time — no Docker, no admin rights, no
shared state with anything else on the machine.

```bash
./pgdev.sh start    # or: "C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe" -D .pgdata -l .pglogs\postgres.log -o "-p 5433" start
./pgdev.sh stop
./pgdev.sh status
```

It's already initialized and running from setup — `pgdev.sh start` is only
needed after a reboot or if you've stopped it. Not started automatically on
login; nothing outside this repo's `.env` points at it.

## Local setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements-dev.txt
cp env.example .env             # already POSTGRES_PORT=5433 — matches pgdev.sh above

./pgdev.sh start                # if not already running
python manage.py migrate        # applies schema + seeds 4 starter roles + the default legal entity
python manage.py runserver 0.0.0.0:3000   # matches the frontend's BACKEND_API_URL
```

Tests run against real Postgres, not sqlite (see
[`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md)'s tech stack table for why)
— confirmed passing against this cluster:

```bash
pytest
ruff check .
black --check .
```

To exercise the real auth flow: `python manage.py seed_demo_users` creates
one login per starter role (password `DemoPass123!`), then `POST
/api/v1/auth/login` with one of those emails. For `/admin/` access
specifically, `python manage.py createsuperuser` still works via Django's own
session auth.

Read, in order, before writing more backend code:

1. [`../docs/REQUIREMENTS.md`](../docs/REQUIREMENTS.md) — roles, scope tiers, modules, security baseline
2. [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) — the seven core primitives, tech stack, API contract
3. [`../docs/IMPLEMENTATION-PLAN.md`](../docs/IMPLEMENTATION-PLAN.md) — phases, timeline, parallelization
4. [`../docs/TASKS.md`](../docs/TASKS.md) — the actual task breakdown to execute against
5. [`../docs/DEVELOPMENT.md`](../docs/DEVELOPMENT.md) — local dev setup once the project scaffold exists
