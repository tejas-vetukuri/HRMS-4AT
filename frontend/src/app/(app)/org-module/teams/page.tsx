'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth/useAuth';
import { adminIsActive, adminRowId, fullName, orgAdminApi, orgApi } from '@/lib/api/org';
import { ManageTable, type ManageField } from '@/components/org-module/manage-table';
import { StatusPill } from '@/components/org-module/ui';

interface Row {
  id: string;
  name: string;
  department: string;
  departmentId: string;
  lead: string;
  leadId: string;
  status: 'Active' | 'Inactive';
}

export default function TeamsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('org.manage');

  const [rows, setRows] = useState<Row[]>([]);
  const [deptOptions, setDeptOptions] = useState<{ value: string; label: string }[]>([]);
  const [leadOptions, setLeadOptions] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const [depts, employees] = await Promise.all([
        orgApi.listDepartments(),
        orgApi.listEmployees(),
      ]);
      const deptNames = new Map(depts.map((d) => [d.id, d.name]));
      const empNames = new Map(employees.map((e) => [e.id, fullName(e)]));
      setDeptOptions(depts.map((d) => ({ value: d.id, label: d.name })));
      setLeadOptions(employees.map((e) => ({ value: e.id, label: `${fullName(e)} (${e.employee_code})` })));

      if (canManage) {
        const teams = await orgAdminApi.list('teams');
        setRows(
          teams.map((t) => {
            const deptId = t.department === null || t.department === undefined ? '' : String(t.department);
            const leadId = t.lead === null || t.lead === undefined ? '' : String(t.lead);
            return {
              id: adminRowId(t),
              name: t.name,
              department: t.departmentName ?? (deptId ? deptNames.get(deptId) ?? '—' : '—'),
              departmentId: deptId,
              lead: t.leadName ?? (leadId ? empNames.get(leadId) ?? '—' : '—'),
              leadId,
              status: adminIsActive(t) ? 'Active' : 'Inactive',
            };
          }),
        );
      } else {
        const teams = await orgApi.listTeams();
        setRows(
          teams.map((t) => ({
            id: t.id,
            name: t.name,
            department: (t.department_id && deptNames.get(t.department_id)) || '—',
            departmentId: t.department_id ?? '',
            lead: (t.lead_id && empNames.get(t.lead_id)) || '—',
            leadId: t.lead_id ?? '',
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
      { name: 'name', label: 'Team name', placeholder: 'e.g. Platform' },
      { name: 'department', label: 'Parent department', type: 'select', options: deptOptions },
      { name: 'lead', label: 'Team lead', type: 'select', options: leadOptions },
    ],
    [deptOptions, leadOptions],
  );

  return (
    <ManageTable<Row>
      title="Teams"
      subtitle="Working groups inside departments, with the day-to-day lead — live from the server."
      rows={rows}
      fields={fields}
      addLabel="Add team"
      canManage={canManage}
      loading={loading}
      loadFailed={loadFailed}
      onRetry={refresh}
      searchPlaceholder="Search by name, department or lead…"
      columns={[
        { key: 'name', label: 'Team' },
        { key: 'department', label: 'Department' },
        { key: 'lead', label: 'Lead' },
        { key: 'status', label: 'Status', render: (r) => <StatusPill value={r.status} /> },
      ]}
      onAdd={async (v) => {
        await orgAdminApi.create('teams', {
          name: v.name.trim(),
          department: v.department || null,
          lead: v.lead || null,
        });
        await refresh();
      }}
      onEdit={async (row, v) => {
        await orgAdminApi.update('teams', row.id, {
          name: v.name.trim(),
          department: v.department || null,
          lead: v.lead || null,
        });
        await refresh();
      }}
      onDeactivate={async (row) => {
        await orgAdminApi.deactivate('teams', row.id);
        await refresh();
      }}
    />
  );
}
