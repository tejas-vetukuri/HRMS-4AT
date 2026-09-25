'use client';

import { useAuth } from '@/lib/auth/useAuth';
import { businessUnits } from '@/lib/mock/org/data';
import type { BusinessUnit } from '@/lib/mock/org/types';
import { MasterTable, StatusPill, type FieldDef } from '@/components/org-module/ui';

const fields: FieldDef[] = [
  { name: 'name', label: 'Business unit name', placeholder: 'e.g. Product & Engineering' },
  { name: 'code', label: 'Code', placeholder: 'e.g. BU-PRD' },
  {
    name: 'legalEntity',
    label: 'Legal entity',
    type: 'select',
    options: ['Acme Technologies Pvt Ltd', 'Acme Inc'],
  },
  { name: 'head', label: 'Head', placeholder: 'Unit head' },
];

export default function BusinessUnitsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('org.manage') || hasPermission('employees.write');

  return (
    <MasterTable<BusinessUnit>
      title="Business Units"
      subtitle="Divisions under each legal entity (mock data, stub actions)."
      rows={businessUnits}
      fields={fields}
      addLabel="Add business unit"
      canManage={canManage}
      searchPlaceholder="Search by name, code or entity…"
      columns={[
        { key: 'name', label: 'Business unit' },
        { key: 'code', label: 'Code' },
        { key: 'legalEntity', label: 'Legal entity' },
        { key: 'head', label: 'Head' },
        { key: 'employees', label: 'Employees' },
        { key: 'status', label: 'Status', render: (r) => <StatusPill value={r.status} /> },
      ]}
    />
  );
}
