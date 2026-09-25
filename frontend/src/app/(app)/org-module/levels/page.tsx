'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/useAuth';
import { adminIsActive, adminRowId, orgAdminApi, orgApi } from '@/lib/api/org';
import { ManageTable, type ManageField } from '@/components/org-module/manage-table';
import { StatusPill } from '@/components/org-module/ui';

interface Row {
  id: string;
  name: string;
  seats: number;
  status: 'Active' | 'Inactive';
}

const fields: ManageField[] = [
  { name: 'name', label: 'Level name', placeholder: 'e.g. L3 · Senior' },
];

export default function LevelsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('org.manage');

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const positions = await orgApi.listPositions().catch(() => []);
      const seats = new Map<string, number>();
      for (const p of positions) {
        if (p.level_id) seats.set(p.level_id, (seats.get(p.level_id) ?? 0) + 1);
      }
      if (canManage) {
        const levels = await orgAdminApi.list('levels');
        setRows(
          levels.map((l) => {
            const id = adminRowId(l);
            return {
              id,
              name: l.name,
              seats: seats.get(id) ?? l.positionCount ?? l.position_count ?? 0,
              status: adminIsActive(l) ? 'Active' : 'Inactive',
            };
          }),
        );
      } else {
        const levels = await orgApi.listLevels();
        setRows(
          levels.map((l) => ({
            id: l.id,
            name: l.name,
            seats: seats.get(l.id) ?? 0,
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
      title="Levels"
      subtitle="Seniority rungs shared across families, with approved seats at each — live from the server."
      rows={rows}
      fields={fields}
      addLabel="Add level"
      canManage={canManage}
      loading={loading}
      loadFailed={loadFailed}
      onRetry={refresh}
      searchPlaceholder="Search by name…"
      columns={[
        { key: 'name', label: 'Level' },
        { key: 'seats', label: 'Seats' },
        { key: 'status', label: 'Status', render: (r) => <StatusPill value={r.status} /> },
      ]}
      onAdd={async (v) => {
        await orgAdminApi.create('levels', { name: v.name.trim() });
        await refresh();
      }}
      onEdit={async (row, v) => {
        await orgAdminApi.update('levels', row.id, { name: v.name.trim() });
        await refresh();
      }}
      onDeactivate={async (row) => {
        await orgAdminApi.deactivate('levels', row.id);
        await refresh();
      }}
    />
  );
}
