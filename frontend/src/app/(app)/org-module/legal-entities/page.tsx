'use client';

import { useAuth } from '@/lib/auth/useAuth';
import { legalEntities } from '@/lib/mock/org/data';
import type { LegalEntity } from '@/lib/mock/org/types';
import { MasterTable, StatusPill, type FieldDef } from '@/components/org-module/ui';

const fields: FieldDef[] = [
  { name: 'name', label: 'Legal entity name', placeholder: 'e.g. Acme Technologies Pvt Ltd' },
  { name: 'code', label: 'Code', placeholder: 'e.g. IN-LE-01' },
  { name: 'country', label: 'Country', type: 'select', options: ['India', 'United States'] },
  { name: 'registrationNo', label: 'Registration no.', placeholder: 'CIN / EIN' },
  { name: 'head', label: 'Head', placeholder: 'Entity head' },
];

export default function LegalEntitiesPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('org.manage') || hasPermission('employees.write');

  return (
    <MasterTable<LegalEntity>
      title="Legal Entities"
      subtitle="Registered entities at the top of the hierarchy (mock data, stub actions)."
      rows={legalEntities}
      fields={fields}
      addLabel="Add legal entity"
      canManage={canManage}
      searchPlaceholder="Search by name, code or country…"
      columns={[
        { key: 'name', label: 'Entity' },
        { key: 'code', label: 'Code' },
        { key: 'country', label: 'Country' },
        { key: 'head', label: 'Head' },
        { key: 'employees', label: 'Employees' },
        { key: 'status', label: 'Status', render: (r) => <StatusPill value={r.status} /> },
      ]}
    />
  );
}
