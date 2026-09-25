'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth/useAuth';
import {
  fullName,
  orgAdminApi,
  orgApi,
  type OrgAdminRow,
  type Position,
} from '@/lib/api/org';
import { ManageModal, type ManageField } from '@/components/org-module/manage-table';
import { PageHeader, StatusPill } from '@/components/org-module/ui';
import { OrgApiError } from '@/lib/api/org';

interface Row {
  id: string;
  shortId: string;
  name: string;
  title: string;
  department: string;
  departmentId: string;
  jobTitleId: string;
  level: string;
  levelId: string;
  gradeId: string;
  businessUnitId: string;
  reportsTo: string;
  reportsToId: string;
  status: 'Filled' | 'Vacant' | 'Hiring' | 'On Hold';
  statusValue: string;
  incumbent: string;
  incumbentId: string;
}

const STATUS_LABEL: Record<string, Row['status']> = {
  filled: 'Filled',
  vacant: 'Vacant',
  hiring: 'Hiring',
  on_hold: 'On Hold',
};

const STATUS_OPTIONS = [
  { value: 'filled', label: 'Filled' },
  { value: 'vacant', label: 'Vacant' },
  { value: 'hiring', label: 'Hiring' },
  { value: 'on_hold', label: 'On Hold' },
];

function toRow(
  p: Position | OrgAdminRow,
  names: {
    depts: Map<string, string>;
    titles: Map<string, string>;
    levels: Map<string, string>;
    positions: Map<string, string>;
    employees: Map<string, string>;
  },
): Row {
  const raw = p as unknown as Record<string, string | null | undefined>;
  const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
  // Read shape is snake_case; admin shape is camelCase — accept both.
  const deptId = str(raw.department_id ?? raw.department);
  const titleId = str(raw.job_title_id ?? raw.jobTitle);
  const levelId = str(raw.level_id ?? raw.level);
  const gradeId = str(raw.grade_id ?? raw.grade);
  const buId = str(raw.business_unit_id ?? raw.businessUnit);
  const reportsToId = str(raw.reports_to_id ?? raw.reportsTo);
  const incumbentId = str(raw.incumbent_id ?? raw.incumbent);
  const statusValue = str(raw.status) || 'vacant';
  const id = str(raw.id);
  const seatName =
    str(raw.name) ||
    (titleId ? names.titles.get(titleId) : undefined) ||
    '—';
  return {
    id,
    shortId: id.slice(0, 8),
    name: seatName,
    title: seatName,
    department: (deptId && names.depts.get(deptId)) || str(raw.departmentName) || '—',
    departmentId: deptId,
    jobTitleId: titleId,
    level: (levelId && names.levels.get(levelId)) || str(raw.levelName) || '—',
    levelId,
    gradeId,
    businessUnitId: buId,
    reportsTo:
      (reportsToId && names.positions.get(reportsToId)) || str(raw.reportsToName) || '—',
    reportsToId,
    status: STATUS_LABEL[statusValue] ?? 'Vacant',
    statusValue,
    incumbent: (incumbentId && names.employees.get(incumbentId)) || str(raw.incumbentName) || '',
    incumbentId,
  };
}

export default function PositionsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('org.manage');

  const [rows, setRows] = useState<Row[]>([]);
  const [deptOptions, setDeptOptions] = useState<{ value: string; label: string }[]>([]);
  const [titleOptions, setTitleOptions] = useState<{ value: string; label: string }[]>([]);
  const [levelOptions, setLevelOptions] = useState<{ value: string; label: string }[]>([]);
  const [gradeOptions, setGradeOptions] = useState<{ value: string; label: string }[]>([]);
  const [buOptions, setBuOptions] = useState<{ value: string; label: string }[]>([]);
  const [reportsOptions, setReportsOptions] = useState<{ value: string; label: string }[]>([]);
  const [incumbentOptions, setIncumbentOptions] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modal, setModal] = useState<{ mode: 'add' | 'edit' | 'deactivate'; row?: Row } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const [depts, titles, levels, grades, bus, employees] = await Promise.all([
        orgApi.listDepartments(),
        orgApi.listDesignations(),
        orgApi.listLevels(),
        orgApi.listGrades(),
        orgApi.listBusinessUnits(),
        orgApi.listEmployees(),
      ]);
      const names = {
        depts: new Map(depts.map((d) => [d.id, d.name])),
        titles: new Map(titles.map((t) => [t.id, t.name])),
        levels: new Map(levels.map((l) => [l.id, l.name])),
        positions: new Map<string, string>(),
        employees: new Map(employees.map((e) => [e.id, fullName(e)])),
      };
      setDeptOptions(depts.map((d) => ({ value: d.id, label: d.name })));
      setTitleOptions(titles.map((t) => ({ value: t.id, label: t.name })));
      setLevelOptions(levels.map((l) => ({ value: l.id, label: l.name })));
      setGradeOptions(grades.map((g) => ({ value: g.id, label: g.name })));
      setBuOptions(bus.map((b) => ({ value: b.id, label: b.name })));
      setIncumbentOptions(
        employees.map((e) => ({ value: e.id, label: `${fullName(e)} (${e.employee_code})` })),
      );

      const raw: (Position | OrgAdminRow)[] = canManage
        ? await orgAdminApi.list('positions')
        : await orgApi.listPositions();
      // Managers see inactive seats too; readers only see active ones.
      const live = canManage ? raw : raw.filter((p) => (p as Position).is_active !== false);
      for (const p of live) {
        const rec = p as unknown as Record<string, unknown>;
        const id = String(rec.id);
        const nm = String(rec.name ?? '');
        if (id && nm) names.positions.set(id, nm);
      }
      setReportsOptions([...names.positions.entries()].map(([value, label]) => ({ value, label })));
      setRows(live.map((p) => toRow(p, names)));
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

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((p) => {
      if (deptFilter && p.department !== deptFilter) return false;
      if (statusFilter && p.status !== statusFilter) return false;
      if (!q) return true;
      return [p.shortId, p.title, p.department, p.level, p.reportsTo, p.incumbent]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [rows, search, deptFilter, statusFilter]);

  const deptFilters = useMemo(() => [...new Set(rows.map((r) => r.department))].sort(), [rows]);

  const fields: ManageField[] = useMemo(
    () => [
      { name: 'name', label: 'Seat title', placeholder: 'e.g. Senior Software Engineer' },
      { name: 'department', label: 'Department', type: 'select', options: deptOptions },
      { name: 'jobTitle', label: 'Job title', type: 'select', options: titleOptions },
      { name: 'level', label: 'Level', type: 'select', options: levelOptions },
      { name: 'grade', label: 'Grade', type: 'select', options: gradeOptions },
      { name: 'businessUnit', label: 'Business unit', type: 'select', options: buOptions },
      { name: 'reportsTo', label: 'Reports to (position)', type: 'select', options: reportsOptions },
      { name: 'statusValue', label: 'Status', type: 'select', options: STATUS_OPTIONS },
      { name: 'incumbent', label: 'Incumbent', type: 'select', options: incumbentOptions },
    ],
    [deptOptions, titleOptions, levelOptions, gradeOptions, buOptions, reportsOptions, incumbentOptions],
  );

  const close = () => {
    if (!saving) {
      setModal(null);
      setFormError(null);
    }
  };

  const payload = (v: Record<string, string>) => ({
    name: v.name.trim(),
    department: v.department || null,
    job_title: v.jobTitle || null,
    level: v.level || null,
    grade: v.grade || null,
    business_unit: v.businessUnit || null,
    reports_to: v.reportsTo || null,
    status: v.statusValue || 'vacant',
    incumbent: v.incumbent || null,
  });

  const run = async (fn: () => Promise<void>) => {
    setSaving(true);
    setFormError(null);
    try {
      await fn();
      await refresh();
      setModal(null);
    } catch (e) {
      setFormError(e instanceof OrgApiError ? e.message : 'Something went wrong. Please retry.');
    } finally {
      setSaving(false);
    }
  };

  const modalTitle =
    modal?.mode === 'add' ? 'Add position' : modal?.mode === 'edit' ? 'Edit position' : 'Set position inactive';

  if (loading) {
    return (
      <div>
        <PageHeader title="Positions" subtitle="Loading…" />
        <div className="bg-white border border-slate-200 rounded-xl p-5 animate-pulse">
          <div className="h-4 w-1/3 bg-slate-100 rounded" />
          <div className="mt-3 space-y-2">
            <div className="h-8 bg-slate-50 rounded" />
            <div className="h-8 bg-slate-50 rounded" />
            <div className="h-8 bg-slate-50 rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {loadFailed ? (
        <div className="mb-4 flex items-center justify-between gap-3 flex-wrap bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-sm text-amber-800">Couldn&apos;t reach the server — showing no records.</p>
          <button
            type="button"
            onClick={refresh}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : null}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <PageHeader
          title="Positions"
          subtitle="Every seat in the org — a position exists even when vacant. Live from the server."
        />
        {canManage ? (
          <button
            type="button"
            onClick={() => setModal({ mode: 'add' })}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          >
            Add position
          </button>
        ) : null}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
              Search
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ID, title, incumbent…"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400"
            />
          </div>
          <div className="min-w-[150px]">
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
              Department
            </label>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400"
            >
              <option value="">All</option>
              {deptFilters.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[150px]">
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400"
            >
              <option value="">All</option>
              {(['Filled', 'Vacant', 'Hiring', 'On Hold'] as const).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <h3 className="text-sm font-bold text-slate-900">Positions</h3>
          <span className="text-xs text-slate-500">
            Showing {visible.length} of {rows.length}
          </span>
        </div>
        {visible.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-slate-500">No records match.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Position ID', 'Title', 'Department', 'Level', 'Reports to', 'Status', 'Incumbent'].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase"
                    >
                      {h}
                    </th>
                  ))}
                  {canManage ? (
                    <th className="px-5 py-3 text-right text-[11px] font-semibold text-slate-500 uppercase">
                      Actions
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 text-sm font-semibold text-slate-900">{p.shortId}</td>
                    <td className="px-5 py-3 text-sm text-slate-700">{p.title}</td>
                    <td className="px-5 py-3 text-sm text-slate-700">{p.department}</td>
                    <td className="px-5 py-3 text-sm text-slate-700">{p.level}</td>
                    <td className="px-5 py-3 text-sm text-slate-700">{p.reportsTo}</td>
                    <td className="px-5 py-3">
                      <StatusPill value={p.status} />
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-700">
                      {p.incumbent || <span className="text-slate-400 italic">Vacant</span>}
                    </td>
                    {canManage ? (
                      <td className="px-5 py-3">
                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => setModal({ mode: 'edit', row: p })}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setModal({ mode: 'deactivate', row: p })}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            Set Inactive
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal?.mode === 'deactivate' && modal.row ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label={modalTitle}
        >
          <div
            className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-lg p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold text-slate-900">{modalTitle}</h3>
            <p className="mt-2 text-sm text-slate-600">
              This hides the seat from pickers but keeps its history. Continue?
            </p>
            {formError ? (
              <p className="mt-2 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                {formError}
              </p>
            ) : null}
            <div className="mt-5 flex gap-2 justify-end">
              <button
                type="button"
                onClick={close}
                disabled={saving}
                className="px-4 py-2 text-sm font-semibold rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => run(() => orgAdminApi.deactivate('positions', (modal.row as Row).id).then(() => undefined))}
                disabled={saving}
                className="px-4 py-2 text-sm font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Set Inactive'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modal && modal.mode !== 'deactivate' ? (
        <ManageModal
          key={`${modal.mode}-${modal.row?.id ?? 'new'}`}
          title={modalTitle}
          fields={fields}
          initial={modal.row as unknown as Record<string, unknown> | undefined}
          saving={saving}
          error={formError}
          submitLabel={modal.mode === 'add' ? 'Add' : 'Save'}
          onClose={close}
          onSubmit={(values) =>
            run(() =>
              modal.mode === 'add'
                ? orgAdminApi.create('positions', payload(values)).then(() => undefined)
                : orgAdminApi.update('positions', (modal.row as Row).id, payload(values)).then(() => undefined),
            )
          }
        />
      ) : null}
    </div>
  );
}
