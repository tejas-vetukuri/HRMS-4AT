"""Live verification of the RBAC engine and the employee directory.

    python manage.py verify_rbac

Builds a small fictional company (8 people, 2 departments, 2 locations, 2 legal
entities, a 3-level reporting chain), then logs in as each person through the
real API and checks who can see and do what, printing every request as it
happens. The whole run is rolled back afterwards, so it is safe to run against
the dev database. Exits non-zero if any check fails.

The fictional people use the reserved `@verify.invalid` domain and are never
committed anywhere; nothing here reads or prints real employee data.
"""

from collections import Counter

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password

from accounts.models import Permission, Role
from audit.models import AuditLog
from core.verification import VerificationCommand
from employees.models import Department, Employee, LegalEntity, Location

User = get_user_model()

PASSWORD = "Verify-Pass-123!"
EMAIL_DOMAIN = "verify.invalid"
API = "/api/v1"

# key, first, last, starter role, department, location, legal entity, manager key
PEOPLE = [
    ("hana", "Hana", "Hart", "HR Admin", "People", "Austin", "A", None),
    ("finn", "Finn", "Ford", "Finance", "Finance", "Austin", "A", None),
    ("dana", "Dana", "Diaz", "Manager", "Engineering", "Austin", "A", None),
    ("maya", "Maya", "Moss", "Manager", "Engineering", "Austin", "A", "dana"),
    ("eli", "Eli", "Egan", "Employee", "Engineering", "Hyderabad", "A", "maya"),
    ("eve", "Eve", "Ames", "Employee", "Engineering", "Austin", "A", "maya"),
    ("omar", "Omar", "Ortiz", "Manager", "Sales", "Austin", "B", None),
    ("sam", "Sam", "Shah", "Employee", "Sales", "Hyderabad", "B", "omar"),
]

ORG_CHART = """\
   Fictional company used for this run
   ------------------------------------------------------------------
   Dana Diaz  (Manager)   Engineering / Austin     / Entity A
   +-- Maya Moss  (Manager)   Engineering / Austin     / Entity A
   |   +-- Eli Egan  (Employee)   Engineering / Hyderabad  / Entity A
   |   +-- Eve Ames  (Employee)   Engineering / Austin     / Entity A
   Omar Ortiz (Manager)   Sales / Austin            / Entity B
   +-- Sam Shah  (Employee)   Sales / Hyderabad       / Entity B
   Hana Hart  (HR Admin)  People / Austin           / Entity A
   Finn Ford  (Finance)   Finance / Austin          / Entity A
   ------------------------------------------------------------------"""


class Command(VerificationCommand):
    title = "RBAC engine and employee directory: live verification"
    help = "Run live RBAC and employee-directory checks against the real API (changes rolled back)."

    # -- setup ------------------------------------------------------------

    def _build_org(self):
        hashed = make_password(PASSWORD)
        entities = {
            "A": LegalEntity.objects.get_or_create(name="VFY Entity A")[0],
            "B": LegalEntity.objects.get_or_create(name="VFY Entity B")[0],
        }
        self.people = {}
        for key, first, last, role_name, dept, location, entity, _manager in PEOPLE:
            email = f"vfy.{key}@{EMAIL_DOMAIN}"
            user = User.objects.create(
                username=email,
                email=email,
                first_name=first,
                last_name=last,
                password=hashed,
                role=Role.objects.get(name=role_name),
            )
            self.people[key] = Employee.objects.create(
                user=user,
                employee_code=f"VFY-{key.upper()}",
                department=Department.objects.get_or_create(name=f"VFY {dept}")[0],
                location=Location.objects.get_or_create(name=f"VFY {location}")[0],
                legal_entity=entities[entity],
            )
        for key, *_middle, manager_key in PEOPLE:
            if manager_key:
                self.people[key].manager = self.people[manager_key]
                self.people[key].save(update_fields=["manager"])

        User.objects.create(
            username=f"vfy.lou@{EMAIL_DOMAIN}",
            email=f"vfy.lou@{EMAIL_DOMAIN}",
            password=hashed,
            role=Role.objects.get(name="Employee"),
        )
        self.by_id = {str(e.pk): key for key, e in self.people.items()}
        self.read_permission_id = Permission.objects.get(code="employees.read").pk

    def email(self, key):
        return f"vfy.{key}@{EMAIL_DOMAIN}"

    def _names(self, keys):
        return ", ".join(sorted(self.people[k].user.first_name for k in keys)) or "nobody"

    # -- helpers ----------------------------------------------------------

    def _listing(self, session):
        response = session.get(f"{API}/employees/")
        rows = response.json().get("data", []) if response.status_code == 200 else []
        ids = {row["id"] for row in rows}
        seen = {self.by_id[i] for i in ids if i in self.by_id}
        return response, seen, len(ids) - len(seen)

    def _expect_sees(self, v, label, session, expected):
        """The caller sees exactly `expected` of the fictional people and no one else."""
        response, seen, others = self._listing(session)
        v.note(f"sees: {self._names(seen)}" + (f" (+{others} others)" if others else ""))
        v.check(
            label,
            response.status_code == 200 and seen == set(expected) and others == 0,
            f"expected {self._names(expected)}; got {self._names(seen)} +{others} others",
        )

    def _give_custom_role(self, v, admin, person_key, tier):
        """Create a brand-new role through the admin API, grant employees.read at
        `tier`, and assign it to a person: the whole custom-role path, live."""
        created = admin.post(
            f"{API}/roles/", {"name": f"VFY {tier} reader", "archetype": "employee"}
        )
        v.expect_status(f"admin creates custom role 'VFY {tier} reader'", created, 201)
        role_id = created.json()["id"]
        grant = admin.post(
            f"{API}/role-permissions/",
            {"role": role_id, "permission": self.read_permission_id, "scopeTier": tier},
        )
        v.expect_status(f"admin grants employees.read at tier '{tier}'", grant, 201)
        assign = admin.patch(f"{API}/users/{self.people[person_key].user_id}/", {"role": role_id})
        v.expect_status(
            f"admin assigns the role to {self.people[person_key].user.first_name}", assign, 200
        )

    # -- the run ----------------------------------------------------------

    def verify(self, v):
        self._audit_baseline = (
            AuditLog.objects.order_by("-id").values_list("id", flat=True).first() or 0
        )
        self._build_org()
        v.section("Setup")
        self.stdout.write(ORG_CHART)

        self._authentication(v)
        self._starter_roles(v)
        self._custom_roles_and_tiers(v)
        self._individual_overrides(v)
        self._admin_surface(v)
        self._sessions_and_deactivation(v)
        self._audit(v)

    def _authentication(self, v):
        v.section("1. Authentication")
        probe = v.session("probe")
        wrong = probe.login(self.email("hana"), "not-the-password")
        v.expect_status("wrong password is rejected", wrong, 401)
        unknown = probe.login(f"nobody@{EMAIL_DOMAIN}", "whatever")
        v.expect(
            "unknown email gets the same answer as a wrong password (no account enumeration)",
            unknown.json(),
            wrong.json(),
        )
        anonymous = probe.get(f"{API}/employees/")
        v.expect_status("no token: directory refuses anonymous callers", anonymous, 401)

        ok = probe.login(self.email("hana"), PASSWORD)
        v.expect_status("correct password logs in", ok, 200)
        v.check("login returns an access token and a refresh token", bool(probe.tokens))
        me = probe.get(f"{API}/users/me").json()["data"]
        v.note(
            f"/users/me: role={me['roles'][0]['name']}, scope={me['scope']['kind']}, "
            f"{len(me['permissions'])} permissions"
        )
        v.check(
            "/users/me reports HR Admin with organisation-wide scope",
            me["roles"][0]["name"] == "HR Admin" and me["scope"]["kind"] == "org",
        )

        old_refresh = probe.tokens["refresh"]
        rotated = probe.post(f"{API}/auth/refresh", {"refreshToken": old_refresh})
        v.expect_status("refresh token is exchanged for a new pair", rotated, 200)
        replay = probe.post(f"{API}/auth/refresh", {"refreshToken": old_refresh})
        v.expect_status("the used refresh token cannot be replayed", replay, 401)
        new_refresh = rotated.json()["data"]["refreshToken"]
        probe.post(f"{API}/auth/logout", {"refreshToken": new_refresh})
        after_logout = probe.post(f"{API}/auth/refresh", {"refreshToken": new_refresh})
        v.expect_status("after logout the refresh token is dead", after_logout, 401)

        lou = v.session("lou")
        limit = settings.ACCOUNT_LOCKOUT_THRESHOLD
        for _ in range(limit):
            lou.login(self.email("lou"), "wrong-guess")
        locked = lou.login(self.email("lou"), PASSWORD)
        v.expect_status(
            f"account locks after {limit} failures, even for the right password", locked, 423
        )

        flood = v.session("flood")
        rate = settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["login"]
        allowed = int(rate.split("/")[0])
        statuses = [
            flood._client.post(
                f"{API}/auth/login",
                {"email": f"x{i}@{EMAIL_DOMAIN}", "password": "x"},
                format="json",
            ).status_code
            for i in range(allowed + 1)
        ]
        v.note(
            f"{allowed + 1} rapid logins from one address: "
            f"first {allowed} -> {set(statuses[:-1])}, next -> {statuses[-1]}"
        )
        v.check(
            f"login is throttled per address after {allowed} attempts",
            statuses[-1] == 429 and 429 not in statuses[:-1],
        )

    def _starter_roles(self, v):
        v.section("2. Directory visibility under the four starter roles")
        eli = v.login("eli", self.email("eli"), PASSWORD)
        self._expect_sees(v, "Employee (scope: self) sees only their own record", eli, {"eli"})
        v.expect_status(
            "Employee opens their own record",
            eli.get(f"{API}/employees/{self.people['eli'].pk}/"),
            200,
        )
        v.expect_status(
            "Employee cannot open a colleague's record (403, not hidden)",
            eli.get(f"{API}/employees/{self.people['eve'].pk}/"),
            403,
        )

        maya = v.login("maya", self.email("maya"), PASSWORD)
        self._expect_sees(
            v,
            "Manager (scope: reporting manager) sees self and direct reports",
            maya,
            {"maya", "eli", "eve"},
        )
        v.expect_status(
            "Manager cannot open someone in another team",
            maya.get(f"{API}/employees/{self.people['sam'].pk}/"),
            403,
        )

        dana = v.login("dana", self.email("dana"), PASSWORD)
        self._expect_sees(
            v,
            "Director as Manager sees direct reports only, not skip-level",
            dana,
            {"dana", "maya"},
        )
        v.expect_status(
            "skip-level record is refused at the Manager tier",
            dana.get(f"{API}/employees/{self.people['eli'].pk}/"),
            403,
        )

        for label, key in (("HR Admin", "hana"), ("Finance", "finn")):
            session = v.login(key, self.email(key), PASSWORD)
            _, seen, _others = self._listing(session)
            v.check(
                f"{label} (scope: all) sees every one of the 8 people", seen == set(self.people)
            )
        hana = v.login("hana", self.email("hana"), PASSWORD)
        found = hana.get(f"{API}/employees/?search=Egan").json()["data"]
        v.check(
            "directory search finds Eli Egan by surname",
            [r["employee_code"] for r in found] == ["VFY-ELI"],
        )
        v.expect_status(
            "reference list (departments) is readable with directory access",
            eli.get(f"{API}/departments/"),
            200,
        )

    def _custom_roles_and_tiers(self, v):
        v.section("3. Custom roles and every scope tier, created at runtime by an admin")
        admin = v.login("hana", self.email("hana"), PASSWORD)
        cases = [
            (
                "team",
                "dana",
                {"dana", "maya", "eli", "eve"},
                "Dana's whole subtree, including skip-level",
            ),
            ("department", "sam", {"sam", "omar"}, "everyone in Sam's department"),
            ("location", "eli", {"eli", "sam"}, "everyone at Eli's location"),
            (
                "legal_entity",
                "maya",
                {"dana", "maya", "eli", "eve", "hana", "finn"},
                "everyone in Maya's legal entity",
            ),
        ]
        for tier, key, expected, meaning in cases:
            v.note(f"--- tier '{tier}': {meaning}")
            self._give_custom_role(v, admin, key, tier)
            persona = v.login(key, self.email(key), PASSWORD)
            self._expect_sees(
                v,
                f"{self.people[key].user.first_name} now sees exactly the '{tier}' population",
                persona,
                expected,
            )
        dana = v.login("dana", self.email("dana"), PASSWORD)
        v.expect_status(
            "team tier reaches the skip-level record that the Manager tier refused",
            dana.get(f"{API}/employees/{self.people['eli'].pk}/"),
            200,
        )
        v.expect_status(
            "team tier still refuses people outside the subtree",
            dana.get(f"{API}/employees/{self.people['sam'].pk}/"),
            403,
        )

    def _individual_overrides(self, v):
        v.section("4. Per-individual overrides")
        admin = v.login("hana", self.email("hana"), PASSWORD)
        eve = v.login("eve", self.email("eve"), PASSWORD)
        self._expect_sees(v, "baseline: Eve (Employee role) sees only herself", eve, {"eve"})

        override = admin.post(
            f"{API}/user-permission-overrides/",
            {
                "user": self.people["eve"].user_id,
                "permission": self.read_permission_id,
                "scopeTier": "all",
                "isGranted": True,
            },
        )
        v.expect_status("admin grants Eve employees.read at 'all', just for her", override, 201)
        _, seen, _others = self._listing(eve)
        v.check(
            "the same login now sees everyone, with no role change and no re-login",
            seen == set(self.people),
        )

        override_id = override.json()["id"]
        denied = admin.patch(
            f"{API}/user-permission-overrides/{override_id}/", {"isGranted": False}
        )
        v.expect_status("admin flips the override to an explicit deny", denied, 200)
        v.expect_status(
            "deny beats the role's own grant: directory is closed to Eve",
            eve.get(f"{API}/employees/"),
            403,
        )

        removed = admin.delete(f"{API}/user-permission-overrides/{override_id}/")
        v.expect_status("admin removes the override", removed, 204)
        self._expect_sees(v, "Eve is back to her role's default (herself only)", eve, {"eve"})

    def _admin_surface(self, v):
        v.section("5. Who may administer roles")
        eve = v.login("eve", self.email("eve"), PASSWORD)
        v.expect_status("Employee cannot list roles", eve.get(f"{API}/roles/"), 403)
        v.expect_status("Employee cannot list users", eve.get(f"{API}/users/"), 403)
        hr_role = Role.objects.get(name="HR Admin").pk
        v.expect_status(
            "Employee cannot promote themselves to HR Admin",
            eve.patch(f"{API}/users/{self.people['eve'].user_id}/", {"role": hr_role}),
            403,
        )
        v.expect_status(
            "Employee cannot grant permissions",
            eve.post(
                f"{API}/role-permissions/",
                {"role": hr_role, "permission": self.read_permission_id, "scopeTier": "all"},
            ),
            403,
        )
        finn = v.login("finn", self.email("finn"), PASSWORD)
        v.expect_status("Finance cannot administer roles", finn.get(f"{API}/roles/"), 403)
        hana = v.login("hana", self.email("hana"), PASSWORD)
        v.expect_status("HR Admin can administer roles", hana.get(f"{API}/roles/"), 200)
        v.check(
            "Eve's role is unchanged after her attempt",
            User.objects.get(pk=self.people["eve"].user_id).role.name == "Employee",
        )

    def _sessions_and_deactivation(self, v):
        v.section("6. Ending access: session revocation and deactivation")
        admin = v.login("hana", self.email("hana"), PASSWORD)
        sam = v.login("sam", self.email("sam"), PASSWORD)
        v.expect_status(
            "Sam is signed in and can read the directory", sam.get(f"{API}/employees/"), 200
        )

        revoked = admin.post(f"{API}/users/{self.people['sam'].user_id}/revoke-sessions/")
        v.expect_status("admin force-logs-out Sam", revoked, 200)
        v.check("at least one session was revoked", revoked.json()["data"]["revokedCount"] >= 1)
        v.expect_status(
            "Sam's refresh token no longer works",
            sam.post(f"{API}/auth/refresh", {"refreshToken": sam.tokens["refresh"]}),
            401,
        )
        still = sam.get(f"{API}/employees/").status_code
        v.note(
            f"Sam's existing access token after revocation -> {still} "
            "(access tokens live until their short expiry; revocation ends the refresh chain)"
        )

        deactivated = admin.patch(f"{API}/users/{self.people['sam'].user_id}/", {"isActive": False})
        v.expect_status("admin deactivates Sam", deactivated, 200)
        v.expect_status(
            "a deactivated user's existing token is refused immediately",
            sam.get(f"{API}/employees/"),
            401,
        )
        fresh = v.session("sam")
        v.expect_status(
            "a deactivated user cannot log in again", fresh.login(self.email("sam"), PASSWORD), 401
        )

    def _audit(self, v):
        v.section("7. Audit trail")
        rows = AuditLog.objects.filter(id__gt=self._audit_baseline)
        counts = Counter(rows.values_list("action", flat=True))
        v.note(f"{rows.count()} audit entries written during this run:")
        for action, n in sorted(counts.items()):
            v.note(f"    {n:>3}  {action}")
        required = [
            "auth.login_succeeded",
            "auth.login_failed",
            "auth.login_locked_out",
            "auth.logout",
            "Role.created",
            "RolePermission.created",
            "User.role_changed",
            "UserPermissionOverride.created",
            "UserPermissionOverride.updated",
            "UserPermissionOverride.deleted",
            "User.sessions_revoked",
            "User.active_status_changed",
        ]
        missing = [a for a in required if a not in counts]
        v.check(
            "every security-relevant action above was recorded", not missing, f"missing: {missing}"
        )
        v.check(
            "role changes are attributed to the admin who made them",
            rows.filter(action="User.role_changed", actor__email=self.email("hana")).exists(),
        )
        v.check(
            "failed logins carry no actor (nobody was authenticated)",
            not rows.filter(action="auth.login_failed", actor__isnull=False).exists(),
        )
