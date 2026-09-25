'use client';

import { useAuth } from '@/lib/auth/useAuth';
import { departments } from '@/lib/mock/org/data';
import type { Department } from '@/lib/mock/org/types';
import { MasterTable, StatusPill, type FieldDef } from '@/components/org-module/ui';

const fields: FieldDef[] = [
  { name: 'name', label: 'Department name', placeholder: 'e.g. Engineering' },
  { name: 'code', label: 'Code', placeholder: 'e.g. DEPT-ENG' },
  {
    name: 'parent',
    label: 'Parent business unit',
    type: 'select',
    options: ['Product & Engineering', 'Consulting Services', 'Corporate'],
  },
  { name: 'head', label: 'Department head', placeholder: 'e.g. Arjun Mehta' },
];

export default function DepartmentsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('org.manage') || hasPermission('employees.write');

  return (
    <MasterTable<Department>
      title="Departments"
      subtitle="Hierarchy-aware: each department sits under a business unit (mock data, stub actions)."
      rows={departments}
      fields={fields}
      addLabel="Add department"
      canManage={canManage}
      searchPlaceholder="Search by name, code, parent or head…"
      columns={[
        { key: 'name', label: 'Department' },
        { key: 'code', label: 'Code' },
        { key: 'parent', label: 'Parent unit' },
        { key: 'head', label: 'Head' },
        { key: 'teams', label: 'Teams' },
        { key: 'employees', label: 'Employees' },
        { key: 'status', label: 'Status', render: (r) => <StatusPill value={r.status} /> },
      ]}
    />
  );
}
