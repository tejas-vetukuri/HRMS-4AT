'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/useAuth';
import { adminIsActive, orgAdminApi, orgApi } from '@/lib/api/org';
import { ManageTable, type ManageField } from '@/components/org-module/manage-table';
import { StatusPill } from '@/components/org-module/ui';

interface Row {
  id: string;
  name: string;
  status: 'Active' | 'Inactive';
}

const fields: ManageField[] = [
  { name: 'name', label: 'Family name', placeholder: 'e.g. Engineering' },
];

export default function JobFamiliesPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('org.manage');

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const families = canManage ? await orgAdminApi.list('job-families') : await orgApi.listJobFamilies();
      setRows(
        families.map((f) => ({
          id: String(f.id),
          name: f.name,
          status: canManage ? (adminIsActive(f) ? 'Active' : 'Inactive') : 'Active',
        })),
      );
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
      title="Job Families"
      subtitle="Top-level occupation groupings — live from the server."
      rows={rows}
      fields={fields}
      addLabel="Add job family"
      canManage={canManage}
      loading={loading}
      loadFailed={loadFailed}
      onRetry={refresh}
      searchPlaceholder="Search by name…"
      columns={[
        { key: 'name', label: 'Family' },
        { key: 'status', label: 'Status', render: (r) => <StatusPill value={r.status} /> },
      ]}
      onAdd={async (v) => {
        await orgAdminApi.create('job-families', { name: v.name.trim() });
        await refresh();
      }}
      onEdit={async (row, v) => {
        await orgAdminApi.update('job-families', row.id, { name: v.name.trim() });
        await refresh();
      }}
      onDeactivate={async (row) => {
        await orgAdminApi.deactivate('job-families', row.id);
        await refresh();
      }}
    />
  );
}
