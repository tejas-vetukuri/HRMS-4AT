"""Live verification harness. Every module and change ships a `verify_<name>`
management command built on this, so its behaviour can be watched happening
against the real API and the real database instead of trusted from a test count.

    class Command(VerificationCommand):
        help = "Live verification of the leave module."

        def verify(self, v):
            v.section("Leave requests")
            hana = v.login("hana@verify.invalid", PASSWORD)
            response = hana.get("/api/v1/leave-requests/")
            v.expect("HR sees every request", response.status_code, 200)

What the harness guarantees:

- Requests go through the full stack (URL routing, JWT authentication, permission
  classes, serializers, audit writes) against the configured Postgres, not
  against mocks. Each request is printed as it is made.
- The whole run is wrapped in a transaction that is rolled back at the end, so
  a verification can create users, roles and records in the dev database
  (which may hold real employee data) without leaving anything behind.
- A failed check makes the command exit non-zero, so the same command can run
  in CI.
"""

import logging
import time
import webbrowser
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path

from django.conf import settings
from django.core.cache import cache
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from rest_framework.test import APIClient


class _Rollback(Exception):
    """Raised at the end of a run to force the enclosing transaction to roll back."""


@contextmanager
def rolled_back():
    """Everything written inside this block is discarded on exit."""
    try:
        with transaction.atomic():
            yield
            raise _Rollback
    except _Rollback:
        pass


def _describe_body(response) -> str:
    """One short phrase about a response body, without echoing its contents
    (the dev database may hold real employee records)."""
    try:
        body = response.json()
    except Exception:
        return ""
    if not isinstance(body, dict):
        return ""
    payload = body.get("data", body.get("results"))
    if isinstance(payload, list):
        return f"{len(payload)} rows"
    error = body.get("error")
    if isinstance(error, dict) and error.get("code"):
        return str(error["code"])
    if body.get("detail"):
        return str(body["detail"])
    return ""


class Session:
    """An API client acting as one person. Prints every request it makes."""

    def __init__(self, verifier, label, ip):
        self.verifier = verifier
        self.label = label
        # A distinct client address per persona keeps the per-IP login
        # throttle from being consumed by unrelated personas in one run.
        self._client = APIClient(REMOTE_ADDR=ip)
        self.tokens = {}
        self.user = {}

    def _send(self, method, path, body=None):
        send = getattr(self._client, method)
        response = send(path, body, format="json") if body is not None else send(path)
        detail = _describe_body(response)
        self.verifier.trace(self.label, method.upper(), path, response.status_code, detail)
        return response

    def get(self, path):
        return self._send("get", path)

    def post(self, path, body=None):
        return self._send("post", path, body if body is not None else {})

    def patch(self, path, body):
        return self._send("patch", path, body)

    def put(self, path, body):
        return self._send("put", path, body)

    def delete(self, path):
        return self._send("delete", path)

    def login(self, email, password):
        """Real POST /auth/login. Returns the response; on success the session
        is authenticated with the issued access token."""
        response = self.post("/api/v1/auth/login", {"email": email, "password": password})
        if response.status_code == 200:
            data = response.json()["data"]
            self.tokens = {"access": data["accessToken"], "refresh": data["refreshToken"]}
            self.user = data["user"]
            self._client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.tokens['access']}")
        return response

    def forget_credentials(self):
        self._client.credentials()


class Verifier:
    def __init__(self, command):
        self.command = command
        self.style = command.style
        self.passed = 0
        self.failed = 0
        self.failures = []
        self.events = []  # everything printed, in order, for the HTML report
        self._ip_counter = 0

    # -- output -----------------------------------------------------------

    def _write(self, text=""):
        self.command.stdout.write(text)
        self.command.stdout.flush()

    def section(self, title):
        self.events.append(("section", title))
        self._write()
        self._write(self.style.MIGRATE_HEADING(f"== {title}"))

    def note(self, text):
        self.events.append(("note", text))
        self._write(f"   {text}")

    def block(self, text):
        """Pre-formatted text (for example an org chart), shown as-is."""
        self.events.append(("block", text))
        self._write(text)

    def trace(self, who, method, path, status, detail=""):
        self.events.append(("trace", who, method, path, status, detail))
        suffix = f"  ({detail})" if detail else ""
        self._write(f"     {who:<8} {method:<6} {path}  ->  {status}{suffix}")

    # -- checks -----------------------------------------------------------

    def check(self, label, ok, detail=""):
        self.events.append(("check", bool(ok), label, "" if ok else detail))
        if ok:
            self.passed += 1
            self._write(f"   {self.style.SUCCESS('PASS')}  {label}")
        else:
            self.failed += 1
            self.failures.append(label)
            extra = f"   [{detail}]" if detail else ""
            self._write(f"   {self.style.ERROR('FAIL')}  {label}{extra}")
        return ok

    def expect(self, label, actual, expected):
        return self.check(label, actual == expected, f"expected {expected!r}, got {actual!r}")

    def expect_status(self, label, response, expected):
        return self.check(
            label,
            response.status_code == expected,
            f"expected HTTP {expected}, got {response.status_code}",
        )

    # -- personas ---------------------------------------------------------

    def session(self, label):
        self._ip_counter += 1
        return Session(self, label, f"10.77.{self._ip_counter // 250}.{self._ip_counter % 250 + 1}")

    def login(self, label, email, password):
        session = self.session(label)
        response = session.login(email, password)
        if response.status_code != 200:
            raise CommandError(
                f"Could not log in as {label} ({email}): HTTP {response.status_code}"
            )
        return session


class VerificationCommand(BaseCommand):
    """Subclass and implement verify(v). Set `title` for the banner."""

    title = "Verification"

    def add_arguments(self, parser):
        parser.add_argument(
            "--html",
            nargs="?",
            const="auto",
            metavar="PATH",
            help="Also write a self-contained HTML report (default: verification-reports/).",
        )
        parser.add_argument(
            "--open", action="store_true", help="Open the HTML report in the default browser."
        )

    def verify(self, v: Verifier):
        raise NotImplementedError

    def _write_report(self, verifier, options, elapsed):
        if not (options.get("html") or options.get("open")):
            return
        from core.verification_report import render_html

        target = options.get("html")
        if not target or target == "auto":
            stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
            name = self.__module__.rsplit(".", 1)[-1]
            target = Path(settings.BASE_DIR) / "verification-reports" / f"{name}-{stamp}.html"
        target = Path(target)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(render_html(self.title, verifier, elapsed), encoding="utf-8")
        self.stdout.write(f"HTML report: {target}")
        if options.get("open"):
            webbrowser.open(target.resolve().as_uri())

    def handle(self, *args, **options):
        if settings.SETTINGS_MODULE.endswith(".prod"):
            raise CommandError("Verification commands do not run against production settings.")

        db = connection.settings_dict
        self.stdout.write(self.style.MIGRATE_HEADING(self.title))
        self.stdout.write(
            f"Database: {db['NAME']} on {db['HOST'] or 'local'}:{db['PORT'] or 'default'}"
            "   (all changes are rolled back at the end)"
        )

        cache.clear()  # throttle counters from earlier in this process
        verifier = Verifier(self)
        started = time.monotonic()
        # Expected 401/403/423 responses would otherwise each print a stderr
        # warning from Django's request logger, interleaved with the trace.
        request_logger = logging.getLogger("django.request")
        previous_level = request_logger.level
        request_logger.setLevel(logging.CRITICAL)
        try:
            with rolled_back():
                self.verify(verifier)
        finally:
            request_logger.setLevel(previous_level)
            cache.clear()

        elapsed = time.monotonic() - started
        total = verifier.passed + verifier.failed
        self.stdout.write("")
        self._write_report(verifier, options, elapsed)
        line = (
            f"{verifier.passed}/{total} checks passed in {elapsed:.1f}s. "
            "Database changes rolled back."
        )
        if verifier.failed:
            self.stdout.write(self.style.ERROR(line))
            for label in verifier.failures:
                self.stdout.write(self.style.ERROR(f"  failed: {label}"))
            raise CommandError(f"{verifier.failed} verification check(s) failed.")
        self.stdout.write(self.style.SUCCESS(line))
