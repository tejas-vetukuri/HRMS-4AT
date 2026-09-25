'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/useAuth';
import { adminEmployeeCount, adminIsActive, adminRowId, orgAdminApi, orgApi } from '@/lib/api/org';
import { ManageTable, type ManageField } from '@/components/org-module/manage-table';
import { StatusPill } from '@/components/org-module/ui';

interface Row {
  id: string;
  name: string;
  code: string;
  city: string;
  country: string;
  employees: number;
  status: 'Active' | 'Inactive';
}

const fields: ManageField[] = [
  { name: 'name', label: 'Location name', placeholder: 'e.g. Bengaluru HQ' },
];

export default function LocationsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('org.manage');

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      if (canManage) {
        const [locs, employees] = await Promise.all([
          orgAdminApi.list('locations'),
          orgApi.listEmployees(),
        ]);
        const counts = new Map<string, number>();
        for (const emp of employees) {
          if (emp.location_id) counts.set(emp.location_id, (counts.get(emp.location_id) ?? 0) + 1);
        }
        setRows(
          locs.map((l) => ({
            id: adminRowId(l),
            name: l.name,
            code: '—',
            city: '—',
            country: '—',
            employees: counts.get(adminRowId(l)) ?? adminEmployeeCount(l),
            status: adminIsActive(l) ? 'Active' : 'Inactive',
          })),
        );
      } else {
        const [locs, employees] = await Promise.all([
          orgApi.listLocations(),
          orgApi.listEmployees(),
        ]);
        setRows(
          locs.map((l) => ({
            id: l.id,
            name: l.name,
            code: '—',
            city: '—',
            country: '—',
            employees: employees.filter((emp) => emp.location_id === l.id).length,
            status: 'Active',
          })),
        );
      }
    } catch {
      // Never an error screen: empty table with a retry affordance.
      setRows([]);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <ManageTable<Row>
      title="Locations"
      subtitle="Live names and headcount from the server; codes, cities and countries are not stored by the backend yet."
      rows={rows}
      fields={fields}
      addLabel="Add location"
      canManage={canManage}
      loading={loading}
      loadFailed={loadFailed}
      onRetry={refresh}
      searchPlaceholder="Search by name…"
      columns={[
        { key: 'name', label: 'Location' },
        { key: 'code', label: 'Code' },
        { key: 'city', label: 'City' },
        { key: 'country', label: 'Country' },
        { key: 'employees', label: 'Employees' },
        { key: 'status', label: 'Status', render: (r) => <StatusPill value={r.status} /> },
      ]}
      onAdd={async (v) => {
        await orgAdminApi.create('locations', { name: v.name.trim() });
        await refresh();
      }}
      onEdit={async (row, v) => {
        await orgAdminApi.update('locations', row.id, { name: v.name.trim() });
        await refresh();
      }}
      onDeactivate={async (row) => {
        await orgAdminApi.deactivate('locations', row.id);
        await refresh();
      }}
    />
  );
}
