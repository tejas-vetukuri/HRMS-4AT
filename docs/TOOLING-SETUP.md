# Local Tooling Setup (Windows)

Full setup for a new machine onboarding onto this repo — frontend and backend. Run
through this once before following [DEVELOPMENT.md](DEVELOPMENT.md).

| Tool | Needed for | Required? |
|---|---|---|
| Git | Cloning/committing to this repo | Required |
| Node.js 20+ | `frontend/` (Next.js 16, React 19) | Required |
| Python 3.11/3.12 | `backend/` (Django + DRF) | Required |
| Docker Desktop | Local Postgres for the backend | Required |
| GitHub CLI (`gh`) | PRs/issues from the terminal | Optional |
| VS Code | Editor used by the team | Optional |

## 1. Git

1. Download from https://git-scm.com/download/win and run the installer — defaults are
   fine for everything (keep "Git from the command line" and the default line-ending
   conversion option).
2. Verify:
   ```powershell
   git --version
   ```
3. If this is a brand-new machine, set your identity once:
   ```powershell
   git config --global user.name "Your Name"
   git config --global user.email "you@example.com"
   ```

## 2. Node.js (frontend)

The frontend (`frontend/`) runs Next.js 16 / React 19, which needs **Node 20 or
later**.

1. Download the **LTS** installer from https://nodejs.org/en/download — this bundles
   npm.
2. Run the installer with defaults (it adds Node and npm to PATH automatically).
3. Close and reopen your terminal.
4. Verify:
   ```powershell
   node --version   # expect v20.x or newer
   npm --version
   ```
5. Install frontend dependencies once tooling is confirmed:
   ```powershell
   cd frontend
   npm install
   cp .env.example .env.local
   ```

## 3. Python (backend)

Django + DRF backend needs **Python 3.11 or 3.12** (avoid 3.13 until you've confirmed
all Phase 0 dependencies — some packages lag on new Python releases).

1. Download the installer from https://www.python.org/downloads/windows/ — pick the
   "Windows installer (64-bit)" for the latest 3.12.x release.
2. Run the installer:
   - Check **"Add python.exe to PATH"** on the first screen — easy to miss, and without
     it `python` won't resolve in a new shell.
   - Choose "Customize installation" and make sure **pip** and **py launcher** are both
     included (on by default).
3. Close and reopen your terminal (PATH changes don't apply to already-open shells).
4. Verify:
   ```powershell
   python --version    # expect Python 3.12.x
   pip --version
   ```

## 4. Docker Desktop (backend database)

Needed for the local Postgres container ([TASKS.md](TASKS.md) `P0-E4-01`).

1. Download from https://www.docker.com/products/docker-desktop/.
2. Run the installer. On Windows it will ask to enable **WSL 2** — accept this; Docker
   Desktop uses WSL 2 as its backend and will prompt to install/update the WSL kernel
   component if needed.
3. Reboot if the installer asks for one.
4. Launch Docker Desktop once from the Start menu and wait for it to report "Docker
   Desktop is running" (whale icon steady in the system tray).
5. Verify from a terminal:
   ```powershell
   docker --version
   docker compose version
   docker run hello-world
   ```
   The last command pulls and runs a tiny test image — if it prints a "Hello from
   Docker!" message, the engine is working end-to-end.

## 5. GitHub CLI (optional)

Only needed if you want to create/manage PRs and issues from the terminal instead of
the GitHub web UI.

1. Download from https://cli.github.com/ and run the installer with defaults.
2. Verify and authenticate:
   ```powershell
   gh --version
   gh auth login
   ```

## 6. VS Code (optional)

The team's default editor; any editor works, but VS Code has first-class extensions for
both halves of this stack.

1. Download from https://code.visualstudio.com/.
2. Recommended extensions once installed: **Python** (ms-python.python), **ESLint**,
   **Prettier**, **Docker** (ms-azuretools.vscode-docker).

## 7. Final check

Run all of these from a fresh terminal — if every command prints a version, you're
ready to follow [DEVELOPMENT.md](DEVELOPMENT.md):

```powershell
git --version
node --version
npm --version
python --version
pip --version
docker --version
docker compose version
```

No other manual setup is needed — everything else (virtualenv, Django, project
dependencies, npm packages) gets created by each app's own setup steps once the tools
above are confirmed working.
