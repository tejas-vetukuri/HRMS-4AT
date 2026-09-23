"""pytest entry point for the plug-in conformance kit.

    from core.testing import assert_module_conforms

    @pytest.mark.django_db
    def test_leave_conforms_to_rbac():
        assert_module_conforms(ENDPOINT)   # ENDPOINT: core.conformance.ScopedEndpoint

Runs exactly the checks the live `verify_<module>` command shows, silently, and
fails the test with every failing check listed.
"""

from io import StringIO

from django.core.management.base import BaseCommand
from django.core.management.color import no_style

from core.conformance import ScopedEndpoint, run_conformance
from core.fictional_org import FictionalOrg
from core.verification import Verifier


def assert_module_conforms(endpoint: ScopedEndpoint):
    command = BaseCommand(stdout=StringIO(), stderr=StringIO(), no_color=True)
    command.style = no_style()
    verifier = Verifier(command)

    org = FictionalOrg.build()
    run_conformance(verifier, org, endpoint)

    assert verifier.failed == 0, "RBAC conformance failures:\n" + "\n".join(
        f"  - {label}" for label in verifier.failures
    )
    return verifier
