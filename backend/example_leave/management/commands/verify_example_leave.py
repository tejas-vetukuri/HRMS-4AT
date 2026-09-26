"""Live proof that the example module plugs into the core: RBAC applies to it
with no module-specific access code.

    python manage.py verify_example_leave [--html] [--open]

A module author copies this file, swaps the ENDPOINT, and has the same proof
for their own module.
"""

from core.conformance import run_conformance
from core.fictional_org import ORG_CHART, FictionalOrg
from core.verification import VerificationCommand
from example_leave.conformance import ENDPOINT


class Command(VerificationCommand):
    title = "Example leave module: RBAC plug-in conformance"
    help = "Prove the example module honours RBAC through the plug-in mechanism (rolled back)."

    def verify(self, v):
        org = FictionalOrg.build()
        v.section("Setup")
        v.block(ORG_CHART)
        run_conformance(v, org, ENDPOINT)
