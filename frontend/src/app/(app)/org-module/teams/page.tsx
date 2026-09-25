'use client';

import { useAuth } from '@/lib/auth/useAuth';
import { teams } from '@/lib/mock/org/data';
import type { Team } from '@/lib/mock/org/types';
import { MasterTable, StatusPill, type FieldDef } from '@/components/org-module/ui';

const fields: FieldDef[] = [
  { name: 'name', label: 'Team name', placeholder: 'e.g. Platform' },
  { name: 'code', label: 'Code', placeholder: 'e.g. TEAM-PLT' },
  {
    name: 'department',
    label: 'Parent department',
    type: 'select',
    options: ['Engineering', 'Design', 'Consulting', 'Finance', 'People', 'Management'],
  },
  { name: 'lead', label: 'Team lead', placeholder: 'e.g. Kiran Shah' },
];

export default function TeamsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('org.manage') || hasPermission('employees.write');

  return (
    <MasterTable<Team>
      title="Teams"
      subtitle="Hierarchy-aware: each team sits under a department (mock data, stub actions)."
      rows={teams}
      fields={fields}
      addLabel="Add team"
      canManage={canManage}
      searchPlaceholder="Search by name, code, department or lead…"
      columns={[
        { key: 'name', label: 'Team' },
        { key: 'code', label: 'Code' },
        { key: 'department', label: 'Department' },
        { key: 'lead', label: 'Lead' },
        { key: 'members', label: 'Members' },
        { key: 'status', label: 'Status', render: (r) => <StatusPill value={r.status} /> },
      ]}
    />
  );
}
