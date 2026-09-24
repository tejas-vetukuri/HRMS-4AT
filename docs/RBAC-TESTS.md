# Module integration tests (human-readable acceptance)

One section per orchestrated task. Written before hand-off so the worker and
tester aim at a fixed target.

---

## [P01] Integrate the payroll module into the core

**Goal:** the `backend/payroll` app (from `origin/payroll_module`, built on the old
baseline) is reworked to plug into the core per `backend/MODULE-GUIDE.md`, so payroll
data is RBAC-scoped like every other module and it passes its own live verification.

**Manual check (for the human):**
1. As an **Employee**, `GET` the payroll list endpoints → they see **only their own**
   payroll records (never a colleague's salary).
2. As a **Manager**, the same endpoints → they see **their team's** records, not the
   whole company.
3. As **HR/Finance (scope: all)** → they see everyone.
4. There is **one** `LegalEntity` concept (the core's `employees.LegalEntity`), not a
   duplicate payroll one.
5. Payroll permission codes appear in the RBAC registry (Access Control screen), not a
   hard-coded `IsPayrollFinance` bypass.

**Automated check:** `python manage.py verify_payroll` — expect exit 0 and a green
`backend/verification-reports/verify_payroll-<timestamp>.html`. Also:
`python manage.py check` clean, migrations apply, and `pytest backend/payroll/tests/`
(a conformance test via `core.testing.assert_module_conforms`) passes.

**Status:** ☑ merged — verify_payroll 25/25, conformance 2/2 (done directly by god after worker pipeline failed on token economics)

## [APP-3] Approvals inbox (frontend)

**Goal:** Give approvers and requesters a UI for the approvals engine — see requests to act on, approve/reject with a note, see your own requests and withdraw them.

**Manual check (for the human):**
1. As a manager with a pending request routed to you, open Approvals → "To approve". The request shows requester, type, payload summary, date. Click Approve (add a note) → row moves to resolved, requester gets a bell notification.
2. Click Reject on another → same, status shows rejected with the note.
3. As the requester, open "My requests" → see your raised requests with status; Withdraw a pending one → status becomes withdrawn.
4. A user with no requests and none to approve sees empty states, not an error.

**Automated check:** frontend typecheck + lint clean (`npx tsc --noEmit`, the repo's eslint). Backend already tested (approvals/tests). Worker adds the `/api/requests` proxy route and confirms it reaches `api/v1/requests`.

**Status:** ☐ not started · ☑ in worker · ☐ in test · ☐ failed · ☐ merged
