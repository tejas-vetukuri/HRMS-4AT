'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth/useAuth';
import { adminIsActive, adminRowId, orgAdminApi, orgApi } from '@/lib/api/org';
import { ManageTable, type ManageField } from '@/components/org-module/manage-table';
import { StatusPill } from '@/components/org-module/ui';

interface Row {
  id: string;
  name: string;
  code: string;
  parent: string;
  parentId: string;
  head: string;
  teams: number;
  employees: number;
  status: 'Active' | 'Inactive';
}

export default function DepartmentsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('org.manage');

  const [rows, setRows] = useState<Row[]>([]);
  const [parentOptions, setParentOptions] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      if (canManage) {
        const [depts, employees] = await Promise.all([
          orgAdminApi.list('departments'),
          orgApi.listEmployees(),
        ]);
        const names = new Map(depts.map((d) => [adminRowId(d), d.name]));
        const counts = new Map<string, number>();
        for (const emp of employees) {
          if (emp.department_id) counts.set(emp.department_id, (counts.get(emp.department_id) ?? 0) + 1);
        }
        setParentOptions(depts.map((d) => ({ value: adminRowId(d), label: d.name })));
        setRows(
          depts.map((d) => {
            const id = adminRowId(d);
            const parentId = d.parent === null || d.parent === undefined ? '' : String(d.parent);
            return {
              id,
              name: d.name,
              code: '—',
              parent: (d.parentName ?? (parentId ? names.get(parentId) : undefined) ?? '—') || '—',
              parentId,
              head: '—',
              teams: 0,
              employees: counts.get(id) ?? 0,
              status: adminIsActive(d) ? 'Active' : 'Inactive',
            };
          }),
        );
      } else {
        const [depts, employees] = await Promise.all([
          orgApi.listDepartments(),
          orgApi.listEmployees(),
        ]);
        setParentOptions([]);
        setRows(
          depts.map((d) => ({
            id: d.id,
            name: d.name,
            code: '—',
            parent: '—',
            parentId: '',
            head: '—',
            teams: 0,
            employees: employees.filter((emp) => emp.department_id === d.id).length,
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

  const fields: ManageField[] = useMemo(
    () => [
      { name: 'name', label: 'Department name', placeholder: 'e.g. Engineering' },
      { name: 'parent', label: 'Parent department', type: 'select', options: parentOptions },
    ],
    [parentOptions],
  );

  return (
    <ManageTable<Row>
      title="Departments"
      subtitle="Live names and headcount from the server; codes and heads are not stored by the backend yet."
      rows={rows}
      fields={fields}
      addLabel="Add department"
      canManage={canManage}
      loading={loading}
      loadFailed={loadFailed}
      onRetry={refresh}
      searchPlaceholder="Search by name or parent…"
      columns={[
        { key: 'name', label: 'Department' },
        { key: 'code', label: 'Code' },
        { key: 'parent', label: 'Parent unit' },
        { key: 'head', label: 'Head' },
        { key: 'teams', label: 'Teams' },
        { key: 'employees', label: 'Employees' },
        { key: 'status', label: 'Status', render: (r) => <StatusPill value={r.status} /> },
      ]}
      onAdd={async (v) => {
        await orgAdminApi.create('departments', {
          name: v.name.trim(),
          parent: v.parent || null,
        });
        await refresh();
      }}
      onEdit={async (row, v) => {
        await orgAdminApi.update('departments', row.id, {
          name: v.name.trim(),
          parent: v.parent || null,
        });
        await refresh();
      }}
      onDeactivate={async (row) => {
        await orgAdminApi.deactivate('departments', row.id);
        await refresh();
      }}
    />
  );
}
