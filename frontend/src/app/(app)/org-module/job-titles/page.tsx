'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/useAuth';
import { adminIsActive, adminRowId, orgAdminApi, orgApi } from '@/lib/api/org';
import { ManageTable, type ManageField } from '@/components/org-module/manage-table';
import { StatusPill } from '@/components/org-module/ui';

interface Row {
  id: string;
  title: string;
  /** Same as title — the key the edit form reads. */
  name: string;
  positions: number;
  status: 'Active' | 'Inactive';
}

const fields: ManageField[] = [
  { name: 'name', label: 'Title / designation', placeholder: 'e.g. Senior Software Engineer' },
];

export default function JobTitlesPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('org.manage');

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      // Seat counts come from the positions list, keyed by designation.
      const positions = await orgApi.listPositions().catch(() => []);
      const seats = new Map<string, number>();
      for (const p of positions) {
        if (p.job_title_id) seats.set(p.job_title_id, (seats.get(p.job_title_id) ?? 0) + 1);
      }
      if (canManage) {
        const titles = await orgAdminApi.list('designations');
        setRows(
          titles.map((t) => {
            const id = adminRowId(t);
            return {
              id,
              // The admin form edits `name`; the table shows it as the title.
              title: t.name,
              name: t.name,
              positions: seats.get(id) ?? 0,
              status: adminIsActive(t) ? 'Active' : 'Inactive',
            };
          }),
        );
      } else {
        const titles = await orgApi.listDesignations();
        setRows(
          titles.map((t) => ({
            id: t.id,
            title: t.name,
            name: t.name,
            positions: seats.get(t.id) ?? 0,
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
      title="Job Titles / Designations"
      subtitle="Master list of designations used across positions — live from the server."
      rows={rows}
      fields={fields}
      addLabel="Add job title"
      canManage={canManage}
      loading={loading}
      loadFailed={loadFailed}
      onRetry={refresh}
      searchPlaceholder="Search by title…"
      columns={[
        { key: 'title', label: 'Title' },
        { key: 'positions', label: 'Positions' },
        { key: 'status', label: 'Status', render: (r) => <StatusPill value={r.status} /> },
      ]}
      onAdd={async (v) => {
        await orgAdminApi.create('designations', { name: v.name.trim() });
        await refresh();
      }}
      onEdit={async (row, v) => {
        await orgAdminApi.update('designations', row.id, { name: v.name.trim() });
        await refresh();
      }}
      onDeactivate={async (row) => {
        await orgAdminApi.deactivate('designations', row.id);
        await refresh();
      }}
    />
  );
}
