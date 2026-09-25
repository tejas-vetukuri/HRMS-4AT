"""Live proof that the payroll module plugs into the core: RBAC scoping applies
to payroll records with no module-specific access code.

    python manage.py verify_payroll [--html] [--open]
"""

from core.conformance import run_conformance
from core.fictional_org import ORG_CHART, FictionalOrg
from core.verification import VerificationCommand
from payroll.conformance import ENDPOINT


class Command(VerificationCommand):
    title = "Payroll module: RBAC plug-in conformance"
    help = "Prove payroll honours RBAC scoping through the plug-in mechanism (rolled back)."

    def verify(self, v):
        org = FictionalOrg.build()
        v.section("Setup")
        v.block(ORG_CHART)
        run_conformance(v, org, ENDPOINT)
