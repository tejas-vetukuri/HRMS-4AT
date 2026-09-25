import type { Permission } from './api';

// Permissions are grouped by the module that owns them — the part of the code
// before the first dot (payroll.read -> "payroll"). GROUP_LABELS give the
// friendly section names; an unknown prefix falls back to a title-cased version,
// so a new module's permissions group automatically.
const GROUP_LABELS: Record<string, string> = {
  employees: 'Employee data',
  ess: 'Self-service (own profile)',
  example_leave: 'Leaves & attendance',
  leave: 'Leaves & attendance',
  attendance: 'Leaves & attendance',
  payroll: 'Payroll',
  org: 'Organisation',
  roles: 'Access control',
  audit: 'Audit & activity',
};

export function groupKey(code: string): string {
  return code.split('.')[0];
}

export function groupLabel(key: string): string {
  return GROUP_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/, (c) => c.toUpperCase());
}

/** Permissions bucketed by friendly module label, each list sorted by code,
 *  the groups sorted by label. */
export function groupPermissions(
  permissions: Permission[],
): { label: string; perms: Permission[] }[] {
  const byGroup = new Map<string, Permission[]>();
  for (const perm of permissions) {
    const label = groupLabel(groupKey(perm.code));
    (byGroup.get(label) ?? byGroup.set(label, []).get(label)!).push(perm);
  }
  return [...byGroup.entries()]
    .map(([label, perms]) => ({ label, perms: perms.sort((a, b) => a.code.localeCompare(b.code)) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
