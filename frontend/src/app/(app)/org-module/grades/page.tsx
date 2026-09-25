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
  { name: 'name', label: 'Grade / band name', placeholder: 'e.g. G3' },
];

export default function GradesPage() {
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
        if (p.grade_id) seats.set(p.grade_id, (seats.get(p.grade_id) ?? 0) + 1);
      }
      if (canManage) {
        const grades = await orgAdminApi.list('grades');
        setRows(
          grades.map((g) => {
            const id = adminRowId(g);
            return {
              id,
              name: g.name,
              seats: seats.get(id) ?? g.positionCount ?? g.position_count ?? 0,
              status: adminIsActive(g) ? 'Active' : 'Inactive',
            };
          }),
        );
      } else {
        const grades = await orgApi.listGrades();
        setRows(
          grades.map((g) => ({
            id: g.id,
            name: g.name,
            seats: seats.get(g.id) ?? 0,
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
      title="Grades / Bands"
      subtitle="Bands attached to the career ladder, with approved seats at each — live from the server."
      rows={rows}
      fields={fields}
      addLabel="Add grade / band"
      canManage={canManage}
      loading={loading}
      loadFailed={loadFailed}
      onRetry={refresh}
      searchPlaceholder="Search by name…"
      columns={[
        { key: 'name', label: 'Band' },
        { key: 'seats', label: 'Seats' },
        { key: 'status', label: 'Status', render: (r) => <StatusPill value={r.status} /> },
      ]}
      onAdd={async (v) => {
        await orgAdminApi.create('grades', { name: v.name.trim() });
        await refresh();
      }}
      onEdit={async (row, v) => {
        await orgAdminApi.update('grades', row.id, { name: v.name.trim() });
        await refresh();
      }}
      onDeactivate={async (row) => {
        await orgAdminApi.deactivate('grades', row.id);
        await refresh();
      }}
    />
  );
}
