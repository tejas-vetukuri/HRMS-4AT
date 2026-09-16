# Requirements

Single company, internal use — one deployment, no tenants, a few hundred to a few
thousand employees. Source: *HRMS — Architecture PRD v1*, §0 and §2, with scope
adjustments from `tasks.md` called out where they apply (see the conflicts section in
[README.md](README.md)).

## 0. Roles

Fixed, small, **not** tenant-configurable — there's one tenant.

| Role | What they can do |
|---|---|
| **Employee** | See and act on their own record — attendance, leave, payslip, profile. |
| **Manager** | Employee, plus read/approve for direct reports (attendance, leave, expense requests). |
| **HR Admin** | Organization-wide read on employee data; owns onboarding/offboarding, employee master data. |
| **Finance** | Payroll and expense data organization-wide; not employee HR records outside of what payroll needs. |

4 roles cover the real need for MVP. If a 5th or 6th role is ever needed (e.g. a separate
IT/system-admin role for user provisioning), it's a new row in the `roles` table —
nothing structural changes. **Open question, not yet resolved:** whether that 5th role
is needed for MVP or can wait — current default is to defer it; HR Admin handles
provisioning in the meantime.

## Modules

| Module | What it is | Leans on (core primitives) |
|---|---|---|
| Attendance | Clock in/out, shifts, regularization | Employee table + manager filter, `requests` table (regularization approval), `employees.status` |
| Leave | Leave types, balances, requests | `requests` table, `send_email` at approve/reject |
| Payroll | Salary structure, slip generation | Employee table, `employees.status` (proration on exit), `documents` table (payslips), reads Attendance/Leave directly |
| Performance | Goals, reviews | `requests` table (review sign-off), `documents` table |
| Expense | Claims, reimbursement | `requests` table, `documents` table (receipts) |
| Assets | Issue/return tracking | `employees.status` (recovery trigger on exit) |
| Helpdesk | HR ticketing | `requests` table (or its own simple ticket table), `send_email` on updates |
| Analytics/Reports | Cross-module reporting | Read queries across the tables above — direct SQL/ORM joins are fine at this scale |
| Community | Posts, polls, praise, announcements | Its own models — not in the original PRD module list; added to match the frontend's existing "Engage" feed |
| Offboarding/Exit | Resignation, notice period, exit checklist, final-settlement summary | `requests` table (exit approval), `employees.status = exited` |

**Recruitment/ATS is explicitly out of scope**, not deferred. Candidates aren't
employees or users, and a candidate pipeline is a separate product surface with its own
auth model — see the conflicts note in [README.md](README.md). The one hire-side
touchpoint that remains: on hire, set `Employee.status = active` via a small hook, no
pipeline behind it.

Payroll and Analytics are the two modules where querying other modules' tables
directly is the deliberate right call at this scale — the module-boundary discipline
that matters for a multi-tenant platform (own-your-tables, no cross-module joins) is
solving a problem (many tenants, many teams, independent deploys) this system
doesn't have.

## Security baseline (non-negotiable)

This is company HR data — PII, compensation, personal documents.

- **Authentication:** hashed passwords (Argon2/bcrypt), or SSO if the company already
  runs Google Workspace/Microsoft 365 (prefer SSO to avoid managing passwords at
  all — **open question**, see below).
- **Authorization:** every route checks role via the core RBAC middleware. No route
  queries the database before this check runs.
- **Least privilege by default:** new roles start with zero permissions; permissions are
  explicitly granted, never explicitly denied.
- **Sensitive fields:** salary, bank details, ID documents are readable only by
  `hr_admin` and `finance`, enforced server-side in the RBAC layer — never left to the
  frontend to hide.
- **Audit everything:** every write to employee data, every approval, and every
  document access goes to the append-only audit log.
- **Transport security:** HTTPS everywhere, no exceptions, even internally.
- **Backups:** automated daily database backups from day one.
- **Data at rest:** encrypt the database volume/disk.
- **No secrets in code:** environment variables / a secrets manager for DB credentials,
  SMTP keys, S3 keys.

**Explicitly not needed at this stage:** per-tenant encryption keys, SOC2-grade
immutable ledgers, field-level ABAC policy engines, rate-limiting per tenant. These solve
problems that only exist once there are external customers.

## Open questions (business decisions, not engineering calls)

| # | Question | Default if unresolved |
|---|---|---|
| 1 | 5th role (IT/System Admin)? | Defer for MVP; HR Admin handles provisioning. |
| 2 | SSO vs. passwords? | Build password auth first; ask stakeholder whether Google Workspace/M365 is required for MVP. |
| 3 | `payload_json` shape validation per `request_type`? | Validate via a dispatched serializer per `request_type` (resolved — see ARCHITECTURE.md). |
| 4 | Document access exceptions? | No blanket rule beyond the per-`entity_type` access matrix (resolved — see ARCHITECTURE.md). |
| 5 | Leave carry-forward policy? | Business decision — default to 0 carry-forward, or capped at 5 days, pending stakeholder confirmation. |
| 6 | Payroll proration formula? | Business decision — default to calendar-days proration, pending stakeholder confirmation. |
