# HRMS-4AT — Project Logs

Status, setup, and how to build modules. Kept short on purpose.

---

## 1. What's built

- **RBAC core** — role + scope-tier permission engine. Every API is auto-scoped: an Employee sees only themselves, a Manager sees their team, HR/Admin sees everyone. No per-screen access code. *(verify_rbac: 98/98)*
- **Employee module** — directory, org structure (departments, sub-departments, locations, legal entities), lifecycle (create / update / exit), manager validation (no self / circular reporting). *(verify_employees: 74/74)*
- **Plug-and-play core** — a new module registers its permissions + views and inherits scoping, audit, error shape and pagination automatically. Reference implementation: `backend/example_leave/`. *(verify_example_leave: 32/32)*
- **Frontend** — Next.js portal. Working: Home, Employees, Organisation, Manage Organisation, Access Control, My Team, Profile. Other menu items are placeholders for modules not built yet.
- **Docker** — one-command full stack (Postgres + backend + frontend).
- **Real data** — 146-employee roster with the reporting hierarchy loads from a private, gitignored file. Never committed to git.

---

## 2. Setup & run (Docker — recommended)

```bash
docker compose up --build
```

- **App:** http://localhost:3001  ·  **API / Django admin:** http://localhost:3000/admin/
- **Stop:** `docker compose down`  (add `-v` to also wipe the database)

### Real vs demo data
- **Real data:** put the HR export at **`docs/roster.xlsx`** *before* `up`. On start it wipes and loads the real roster.
- **No file:** you get demo data instead — the app still runs.
- **Added the file after starting?** `docker compose restart backend` (re-runs the loader).

### Logins
**With `docs/roster.xlsx` (real data):**

| Role | Email | Password |
|------|-------|----------|
| Super admin (Django admin) | `admin@hrms.local` | `Admin12345!` |
| HR Admin — sees everyone | `4at0065@consult-4at.com` | `Welcome@123` |
| Manager — sees their team | `4at0111@consult-4at.com` | `Welcome@123` |
| Employee — sees only self | `4at0006@consult-4at.com` | `Welcome@123` |

**Without the file (demo data):** `admin@hrms.local` / `Admin12345!`, or any `demo.*@hrms.local` (e.g. `demo.maya` Manager, `demo.eli` Employee) / `DemoPass123!`.

### Local dev (no Docker)
Postgres on `:5433`, Python venv, `manage.py migrate && runserver 0.0.0.0:3000`; frontend `npm install && npm run dev`. Set `MOCK_AUTH=false` in `frontend/.env.local`. See `docs/DEVELOPMENT.md`.

---

## 3. Building a module (the proper way)

Copy **`backend/example_leave/`** — it's a complete, working example. Five steps (full contract in **`backend/MODULE-GUIDE.md`**):

1. **Register the app** — add it to `INSTALLED_APPS`. This is the *only* core file you edit; routes and permissions are discovered automatically.
2. **Declare permissions** in `<app>/rbac.py` via `register_permissions(...)`, with scope-tier default grants per role. `manage.py migrate` creates them.
3. **Own your data by employee** — give employee-owned models a FK named `employee` → the core scope-checks every record through it.
4. **Write the viewset** — set `required_permission` / `write_permission` / `action_permissions` as class attributes, and filter list queries with `resolve_employee_scope(self.request.user, ...)`. Never trust the request body for ownership.
5. **Prove it** — add a conformance test (`assert_module_conforms`) and a `verify_<app>` management command that produces a real pass/fail. Run it before you call it done.

Follow `backend/CLAUDE.md` / `frontend/CLAUDE.md` for repo conventions.

---

## 4. Data privacy

`docs/roster.xlsx` is **real names and emails** — gitignored, never pushed. Share it with teammates through a password manager or private drive, not GitHub. The repo carries code + demo data only.
