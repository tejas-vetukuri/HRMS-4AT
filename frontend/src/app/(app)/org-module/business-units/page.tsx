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
  legalEntity: string;
  head: string;
  employees: number;
  status: 'Active' | 'Inactive';
}

const fields: ManageField[] = [
  { name: 'name', label: 'Business unit name', placeholder: 'e.g. Product & Engineering' },
];

export default function BusinessUnitsPage() {
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
        const [units, employees] = await Promise.all([
          orgAdminApi.list('business-units'),
          orgApi.listEmployees(),
        ]);
        const counts = new Map<string, number>();
        for (const emp of employees) {
          if (emp.business_unit_id) counts.set(emp.business_unit_id, (counts.get(emp.business_unit_id) ?? 0) + 1);
        }
        setRows(
          units.map((u) => ({
            id: adminRowId(u),
            name: u.name,
            code: '—',
            legalEntity: '—',
            head: '—',
            employees: counts.get(adminRowId(u)) ?? adminEmployeeCount(u),
            status: adminIsActive(u) ? 'Active' : 'Inactive',
          })),
        );
      } else {
        const [units, employees] = await Promise.all([
          orgApi.listBusinessUnits(),
          orgApi.listEmployees(),
        ]);
        setRows(
          units.map((u) => ({
            id: u.id,
            name: u.name,
            code: '—',
            legalEntity: '—',
            head: '—',
            employees: employees.filter((emp) => emp.business_unit_id === u.id).length,
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
      title="Business Units"
      subtitle="Live names and headcount from the server; codes, legal-entity links and heads are not stored by the backend yet."
      rows={rows}
      fields={fields}
      addLabel="Add business unit"
      canManage={canManage}
      loading={loading}
      loadFailed={loadFailed}
      onRetry={refresh}
      searchPlaceholder="Search by name…"
      columns={[
        { key: 'name', label: 'Business unit' },
        { key: 'code', label: 'Code' },
        { key: 'legalEntity', label: 'Legal entity' },
        { key: 'head', label: 'Head' },
        { key: 'employees', label: 'Employees' },
        { key: 'status', label: 'Status', render: (r) => <StatusPill value={r.status} /> },
      ]}
      onAdd={async (v) => {
        await orgAdminApi.create('business-units', { name: v.name.trim() });
        await refresh();
      }}
      onEdit={async (row, v) => {
        await orgAdminApi.update('business-units', row.id, { name: v.name.trim() });
        await refresh();
      }}
      onDeactivate={async (row) => {
        await orgAdminApi.deactivate('business-units', row.id);
        await refresh();
      }}
    />
  );
}
