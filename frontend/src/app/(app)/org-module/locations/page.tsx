'use client';

import { useAuth } from '@/lib/auth/useAuth';
import { locations } from '@/lib/mock/org/data';
import type { OrgLocation } from '@/lib/mock/org/types';
import { MasterTable, StatusPill, type FieldDef } from '@/components/org-module/ui';

const fields: FieldDef[] = [
  { name: 'name', label: 'Location name', placeholder: 'e.g. Bengaluru HQ' },
  { name: 'code', label: 'Code', placeholder: 'e.g. BLR-HQ' },
  { name: 'city', label: 'City', placeholder: 'e.g. Bengaluru' },
  { name: 'country', label: 'Country', type: 'select', options: ['India', 'United States'] },
];

export default function LocationsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('org.manage') || hasPermission('employees.write');

  return (
    <MasterTable<OrgLocation>
      title="Locations"
      subtitle="Offices and remote hubs where employees sit (mock data, stub actions)."
      rows={locations}
      fields={fields}
      addLabel="Add location"
      canManage={canManage}
      searchPlaceholder="Search by name, code or city…"
      columns={[
        { key: 'name', label: 'Location' },
        { key: 'code', label: 'Code' },
        { key: 'city', label: 'City' },
        { key: 'country', label: 'Country' },
        { key: 'employees', label: 'Employees' },
        { key: 'status', label: 'Status', render: (r) => <StatusPill value={r.status} /> },
      ]}
    />
  );
}
