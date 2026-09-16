# Architecture

Source: *HRMS — Architecture PRD v1* §1, §3, §5, reconciled with the *Implementation
Plan*'s Django/DRF choice (see the PRD self-contradiction noted in
[README.md](README.md) — the PRD's own diagram says Django, its own table says
NestJS; Django is what's actually being built).

Nothing below is a framework. Each primitive is the smallest thing that closes a real
requirement, and every module (Attendance, Leave, Payroll, …) reads and writes through
these seven instead of inventing its own version of any of them.

## The seven core primitives

| # | Primitive | Django app / model(s) | What it closes |
|---|---|---|---|
| 1 | Employee/org table | `employees` — `Employee` (self-FK `manager`), `Department`, `Designation` | One source of truth for "who reports to whom." A self-referencing FK with a recursive CTE is enough — no graph DB. Direct reports only for MVP. |
| 2 | RBAC + manager filter | `accounts` app + `core/scope.py::visible_employee_ids(user)` | A `roles`/`permissions`/`role_permissions` table set, checked in middleware. **Not** ABAC, not per-request field-level policy evaluation — 4 roles covers real HR permission needs. The manager filter is the direct fix for a confirmed, live IDOR (any employee could read any other employee's record) — applied inline in every employee-keyed queryset: `WHERE employee_id IN (visible_employee_ids(user))`. One `WHERE` clause per query, not a scope service or guard abstraction — but it has to be there in every module that exposes an employee-keyed read or write. |
| 3 | Approval workflow | `approvals` app — `Request(id, request_type, requester, approver, status, payload_json, created_at, updated_at)` | One generic table backs every approval flow (leave, expense, asset, attendance regularization, exit). `approver` is decided by application code at creation time (typically `requester.manager`) — no configurable routing engine, no multi-level escalation. |
| 4 | Audit log | `audit` app — `AuditLog(id, actor, action, entity_type, entity_id, diff_json, created_at)`, append-only | Nothing ever deletes from it. Written via a direct function call, `write_audit(...)`, at each mutation point that changes something worth tracking — not an event bus, not a signed ledger. |
| 5 | Notifications | `notifications` app — `send_email(...)` / Slack webhook helper | A direct function call invoked at specific trigger points ("leave approved" calls `send_email` right there in the approval handler). No message broker, no pub/sub. |
| 6 | File storage | `documents` app — `Document(id, entity_type, entity_id, path, uploaded_by, uploaded_at)` + S3/local disk | The `documents` table is the abstraction — not a storage interface layer. Access is derived from a per-`entity_type` access matrix (e.g. `payslip` → employee + hr_admin + finance; `id_document` → employee + hr_admin). |
| 7 | Employee status | Plain enum column, `Employee.status` (`active` / `on_leave` / `exited`) | Gates writes (no clock-in if exited, prorate payroll on exit) and drives lifecycle triggers (asset recovery). Literally one column — not a state-machine engine. |

## Request authorization flow

```
HTTP request
    ↓
Auth middleware — who are you
    ↓
Role check — does this role hold the permission        → no  → 403
    ↓ yes, and it's an employee-keyed read/write
Inline WHERE filter — self OR (manager_id = caller, if role = manager)   → not in filter → 403
    ↓
Module handler
    ↓
PostgreSQL — one DB
```

No route queries the database before the role check runs.

## Approval request lifecycle

```
requester creates row in `requests`
            ↓
         pending
        /    |    \
approver  approver  requester
 acts      acts      cancels
   ↓         ↓          ↓
approved  rejected  withdrawn
(terminal)(terminal)(terminal)
```

Terminal states never transition again. An HR Admin can reassign a stuck `pending`
request's approver, or force-resolve it directly — the escape hatch for when the
original approver goes on leave, exits, or is reassigned mid-request.

## How a new module gets built

1. Owns its own tables → PostgreSQL (Django models/migrations).
2. Checks permission via → `roles`/`permissions` tables.
3. Filters employee-keyed queries inline via → `manager_id`/self `WHERE` clause
   (`visible_employee_ids`).
4. Needs approval? → writes a row to `requests`.
5. Needs to tell someone? → calls `send_email(...)`.
6. Needs a file? → writes a row to `documents`.
7. Mutated something? → calls `write_audit(...)`.

Nothing above the primitives has its own login, its own approval logic, or its own audit
log — it all goes through the seven primitives. That delegation is what makes a module
"plug and play."

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Backend | Django + DRF, one deployable, organized by app folder | No hard module-boundary enforcement needed at this size — Payroll reading Attendance/Leave tables directly is fine here. |
| Database | PostgreSQL, single schema, Django ORM | Direct control over the exact queries the manager-filter depends on. No `organization_id` anywhere — there's no second tenant to isolate from. |
| Auth | JWT access + refresh (`djangorestframework-simplejwt`), Argon2 password hashing | Matches the frontend's existing cookie-based flow without frontend changes. `ROTATE_REFRESH_TOKENS=True`, `BLACKLIST_AFTER_ROTATION=True`. |
| Access control | `roles`/`permissions`/`role_permissions` + DRF permission class, plus the inline manager-filter | A small reusable function (`core/scope.py`), not an ABAC framework. Single role per user for MVP — a direct FK from `User` to `Role`, not M2M. |
| Approvals | One generic `requests` table (`approvals` app) | No workflow/BPM engine. |
| Events/notifications | Direct function calls at the point of action (`send_email`, `write_audit`) | No message broker, no in-process event bus. |
| File storage | S3 (`django-storages`, or local disk for smaller deployments) + `documents` table of path pointers | No storage abstraction interface. |
| Frontend | Unchanged — Next.js, role-driven UI gating | See [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md) for the exact API contract. |
| Testing | `pytest-django` + `factory_boy` against real Postgres | No sqlite shortcuts — the manager-filter's exact query behavior has to be verified against the real engine. |

**Roles & permissions:** single role per user for MVP (Employee, Manager, HR Admin,
Finance). Permissions are enumerated strings in **dot-notation**
(`attendance.read.self`, `attendance.read.team`, `leave.approve`, `expense.write`,
`scope.all`) — see the notation conflict noted in [README.md](README.md).

## Explicitly not being built

Multi-tenancy, a scope/ABAC engine, a workflow/BPM engine, a message queue or event
bus, a storage abstraction layer, tenant-configurable custom roles, a state-machine
engine for employee status, per-tenant encryption keys, SOC2-grade immutable ledgers,
field-level ABAC policy engines, rate-limiting per tenant. All of these solve problems a
platform sold to many companies has, and one company running its own system doesn't.
