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
