"""Payroll permissions and the default scope each role gets (PRD §8 Roles and
Permissions). Admins can change these later; re-running migrate never
overwrites their changes (see core/registry.py).

Maker-checker is expressed through separate codes: preparing a run
(payroll.process), Finance review (payroll.review), final approval
(payroll.approve), finalize (payroll.finalize) and the privileged reopen
(payroll.reopen) are distinct, so no single starter role can prepare and
approve the same payroll unless an admin deliberately grants both."""

from core.enums import ScopeTier
from core.registry import PermissionSpec, register_permissions

ALL = ScopeTier.ALL

register_permissions(
    PermissionSpec(
        "payroll.read",
        "View payroll records within the holder's scope",
        default_grants={
            "Employee": ScopeTier.SELF,
            "Manager": ScopeTier.MANAGER,
            "HR Admin": ALL,
            "Finance": ALL,
            "Payroll Admin": ALL,
            "Finance Reviewer": ALL,
            "Payroll Approver": ALL,
            "Auditor": ALL,
        },
    ),
    PermissionSpec(
        "payroll.write",
        "Maintain employee payroll data: payroll profile, compensation proposals, inputs",
        default_grants={"HR Admin": ALL, "Finance": ALL, "Payroll Admin": ALL},
    ),
    PermissionSpec(
        "payroll.manage",
        "Manage payroll configuration: components, structures, pay groups, statutory rules",
        default_grants={"HR Admin": ALL, "Finance": ALL, "Payroll Admin": ALL},
    ),
    PermissionSpec(
        "payroll.process",
        "Prepare payroll: open periods, capture inputs, calculate, submit for approval",
        default_grants={"HR Admin": ALL, "Finance": ALL, "Payroll Admin": ALL},
    ),
    PermissionSpec(
        "payroll.review",
        "Finance review stage of payroll runs and compensation revisions",
        default_grants={"Finance": ALL, "Finance Reviewer": ALL},
    ),
    PermissionSpec(
        "payroll.approve",
        "Final approval of payroll runs and compensation revisions",
        default_grants={"HR Admin": ALL, "Payroll Approver": ALL},
    ),
    PermissionSpec(
        "payroll.finalize",
        "Finalize and lock an approved payroll run",
        default_grants={"HR Admin": ALL, "Payroll Approver": ALL},
    ),
    PermissionSpec(
        "payroll.reopen",
        "Reopen a finalized payroll (privileged; reason required)",
        default_grants={"HR Admin": ALL},
    ),
    PermissionSpec(
        "payroll.release",
        "Generate and release payslips, payment files, statutory reports and journal",
        default_grants={"HR Admin": ALL, "Finance": ALL, "Payroll Admin": ALL},
    ),
    PermissionSpec(
        "payroll.override",
        "Override a calculated payroll component with a mandatory reason",
        default_grants={"HR Admin": ALL, "Payroll Admin": ALL},
    ),
    PermissionSpec(
        "payroll.sensitive.read",
        "See unmasked bank account, PAN and UAN values",
        default_grants={"HR Admin": ALL, "Finance": ALL, "Payroll Admin": ALL},
    ),
    PermissionSpec(
        "payroll.audit",
        "Read the payroll audit trail and reports (read-only)",
        default_grants={"HR Admin": ALL, "Finance": ALL, "Payroll Admin": ALL, "Auditor": ALL},
    ),
)
