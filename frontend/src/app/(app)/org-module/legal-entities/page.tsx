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
  country: string;
  registrationNo: string;
  head: string;
  employees: number;
  status: 'Active' | 'Inactive';
}

const fields: ManageField[] = [
  { name: 'name', label: 'Legal entity name', placeholder: 'e.g. Acme Technologies Pvt Ltd' },
];

export default function LegalEntitiesPage() {
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
        const [entities, employees] = await Promise.all([
          orgAdminApi.list('legal-entities'),
          orgApi.listEmployees(),
        ]);
        const counts = new Map<string, number>();
        for (const emp of employees) {
          if (emp.legal_entity_id) counts.set(emp.legal_entity_id, (counts.get(emp.legal_entity_id) ?? 0) + 1);
        }
        setRows(
          entities.map((e) => ({
            id: adminRowId(e),
            name: e.name,
            // The reference table stores names only — no code/country/head yet.
            code: '—',
            country: '—',
            registrationNo: '—',
            head: '—',
            employees: counts.get(adminRowId(e)) ?? adminEmployeeCount(e),
            status: adminIsActive(e) ? 'Active' : 'Inactive',
          })),
        );
      } else {
        const [entities, employees] = await Promise.all([
          orgApi.listLegalEntities(),
          orgApi.listEmployees(),
        ]);
        setRows(
          entities.map((e) => ({
            id: e.id,
            name: e.name,
            code: '—',
            country: '—',
            registrationNo: '—',
            head: '—',
            employees: employees.filter((emp) => emp.legal_entity_id === e.id).length,
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
      title="Legal Entities"
      subtitle="Live names and headcount from the server; codes, countries and heads are not stored by the backend yet."
      rows={rows}
      fields={fields}
      addLabel="Add legal entity"
      canManage={canManage}
      loading={loading}
      loadFailed={loadFailed}
      onRetry={refresh}
      searchPlaceholder="Search by name…"
      columns={[
        { key: 'name', label: 'Legal entity' },
        { key: 'code', label: 'Code' },
        { key: 'country', label: 'Country' },
        { key: 'registrationNo', label: 'Registration no.' },
        { key: 'head', label: 'Head' },
        { key: 'employees', label: 'Employees' },
        { key: 'status', label: 'Status', render: (r) => <StatusPill value={r.status} /> },
      ]}
      onAdd={async (v) => {
        await orgAdminApi.create('legal-entities', { name: v.name.trim() });
        await refresh();
      }}
      onEdit={async (row, v) => {
        await orgAdminApi.update('legal-entities', row.id, { name: v.name.trim() });
        await refresh();
      }}
      onDeactivate={async (row) => {
        await orgAdminApi.deactivate('legal-entities', row.id);
        await refresh();
      }}
    />
  );
}
