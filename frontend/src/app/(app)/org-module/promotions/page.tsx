'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth/useAuth';
import { fullName, orgApi, OrgApiError, type NamedEntity, type OrgEmployee } from '@/lib/api/org';
import {
  orgChangesApi,
  type OrgChange,
  type OrgChangeStatus,
} from '@/lib/api/orgchanges';
import { PageHeader, StatusPill } from '@/components/org-module/ui';

const CHANGE_TYPE = 'promotion' as const;

interface Option {
  value: string;
  label: string;
}

function toOptions(entities: NamedEntity[]): Option[] {
  return entities.map((e) => ({ value: e.id, label: e.name }));
}

function nameOf(entities: NamedEntity[], id: unknown): string | null {
  if (id === null || id === undefined || id === '') return null;
  return entities.find((e) => String(e.id) === String(id))?.name ?? null;
}

function renderPayload(
  data: Record<string, unknown>,
  resolvers: { match: (key: string) => NamedEntity[] | null; label: (key: string) => string }[],
): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(data ?? {})) {
    if (value === null || value === undefined || value === '') continue;
    let text: string | null = null;
    let label = key;
    for (const r of resolvers) {
      const list = r.match(key);
      if (list) {
        label = r.label(key);
        text = nameOf(list, value) ?? String(value);
        break;
      }
    }
    parts.push(`${label}: ${text ?? String(value)}`);
  }
  return parts.length > 0 ? parts.join(' · ') : '—';
}

const STATUSES: OrgChangeStatus[] = ['pending', 'effective', 'cancelled'];

export default function PromotionsPage() {
  const { hasPermission } = useAuth();
  const canManage =
    hasPermission('orgchanges.write') ||
    hasPermission('org.manage') ||
    hasPermission('employees.write');

  const [changes, setChanges] = useState<OrgChange[]>([]);
  const [employees, setEmployees] = useState<OrgEmployee[]>([]);
  const [designations, setDesignations] = useState<NamedEntity[]>([]);
  const [levels, setLevels] = useState<NamedEntity[]>([]);
  const [grades, setGrades] = useState<NamedEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [employeeId, setEmployeeId] = useState('');
  const [designationId, setDesignationId] = useState('');
  const [levelId, setLevelId] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const [list, emps, desigs, lvls, grds] = await Promise.all([
        orgChangesApi.list({ change_type: CHANGE_TYPE }),
        orgApi.listEmployees(),
        orgApi.listDesignations(),
        orgApi.listLevels(),
        orgApi.listGrades(),
      ]);
      setChanges(list);
      setEmployees(emps);
      setDesignations(desigs);
      setLevels(lvls);
      setGrades(grds);
    } catch {
      setChanges([]);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const employeeNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of employees) m.set(e.id, fullName(e));
    return m;
  }, [employees]);

  const resolvers = useMemo(
    () => [
      {
        match: (key: string) =>
          key === 'designation_id' || key === 'designation' ? designations : null,
        label: () => 'Title',
      },
      {
        match: (key: string) => (key === 'level_id' || key === 'level' ? levels : null),
        label: () => 'Level',
      },
      {
        match: (key: string) => (key === 'grade_id' || key === 'grade' ? grades : null),
        label: () => 'Grade',
      },
    ],
    [designations, levels, grades],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return changes.filter((c) => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (fromDate && c.effective_date < fromDate) return false;
      if (toDate && c.effective_date > toDate) return false;
      if (!q) return true;
      const hay = [
        employeeNames.get(c.employee_id) ?? c.employee_id,
        renderPayload(c.from_data, resolvers),
        renderPayload(c.to_data, resolvers),
        c.changed_by_id ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [changes, search, statusFilter, fromDate, toDate, employeeNames, resolvers]);

  const resetForm = () => {
    setEmployeeId('');
    setDesignationId('');
    setLevelId('');
    setGradeId('');
    setEffectiveDate('');
    setFormError(null);
  };

  const submit = async () => {
    setFormError(null);
    if (!employeeId) {
      setFormError('Select an employee.');
      return;
    }
    if (!designationId && !levelId && !gradeId) {
      setFormError('Select at least one of title, level or grade.');
      return;
    }
    if (!effectiveDate) {
      setFormError('Pick an effective date.');
      return;
    }
    const emp = employees.find((e) => e.id === employeeId);
    const to_data: Record<string, unknown> = {};
    if (designationId) to_data.designation_id = designationId;
    if (levelId) to_data.level_id = levelId;
    if (gradeId) to_data.grade_id = gradeId;
    const from_data: Record<string, unknown> = {};
    if (emp?.designation_id) from_data.designation_id = emp.designation_id;
    setSaving(true);
    try {
      await orgChangesApi.create({
        employee_id: employeeId,
        change_type: CHANGE_TYPE,
        from_data,
        to_data,
        effective_date: effectiveDate,
      });
      setModalOpen(false);
      resetForm();
      await refresh();
    } catch (e) {
      setFormError(e instanceof OrgApiError ? e.message : 'Could not log the promotion.');
    } finally {
      setSaving(false);
    }
  };

  const cancelChange = async (id: string) => {
    try {
      await orgChangesApi.cancel(id);
      await refresh();
    } catch (e) {
      setFormError(e instanceof OrgApiError ? e.message : 'Could not cancel the change.');
    }
  };

  const selectClass =
    'mt-1 block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-slate-300 disabled:opacity-60';

  return (
    <div>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <PageHeader
          title="Promotions"
          subtitle="Effective-dated promotion history with audit trail."
        />
        {canManage ? (
          <button
            type="button"
            onClick={() => {
              resetForm();
              setModalOpen(true);
            }}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          >
            Log promotion
          </button>
        ) : null}
      </div>

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

      {formError && !modalOpen ? (
        <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
          <p className="text-sm text-rose-700">{formError}</p>
        </div>
      ) : null}

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
              placeholder="Search by employee, title or changed-by…"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400"
            />
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
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
              Effective from
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
              Effective to
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400"
            />
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <h3 className="text-sm font-bold text-slate-900">Promotions</h3>
          <span className="text-xs text-slate-500">
            Showing {visible.length} of {changes.length}
          </span>
        </div>
        {loading ? (
          <div className="p-5 animate-pulse space-y-2">
            <div className="h-8 bg-slate-50 rounded" />
            <div className="h-8 bg-slate-50 rounded" />
            <div className="h-8 bg-slate-50 rounded" />
          </div>
        ) : visible.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-slate-500">No records match.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Employee', 'From', 'To', 'Effective date', 'Status', 'Changed by', 'Recorded (audit)'].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-5 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase"
                      >
                        {h}
                      </th>
                    ),
                  )}
                  {canManage ? (
                    <th className="px-5 py-3 text-right text-[11px] font-semibold text-slate-500 uppercase">
                      Actions
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 text-sm font-semibold text-slate-900">
                      {employeeNames.get(c.employee_id) ?? c.employee_id}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-700">
                      {renderPayload(c.from_data, resolvers)}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-700">
                      {renderPayload(c.to_data, resolvers)}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-700">{c.effective_date}</td>
                    <td className="px-5 py-3">
                      <StatusPill value={c.status} />
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-700">{c.changed_by_id ?? '—'}</td>
                    <td className="px-5 py-3 text-xs text-slate-500">{c.updated_at}</td>
                    {canManage ? (
                      <td className="px-5 py-3 text-right">
                        {c.status === 'pending' ? (
                          <button
                            type="button"
                            onClick={() => cancelChange(c.id)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            Cancel
                          </button>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => (!saving ? setModalOpen(false) : undefined)}
          role="dialog"
          aria-modal="true"
          aria-label="Log promotion"
        >
          <div
            className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-lg p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold text-slate-900">Log promotion</h3>
            {formError ? (
              <p className="mt-2 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                {formError}
              </p>
            ) : null}
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-medium text-slate-600">
                Employee
                <select
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  disabled={saving}
                  className={selectClass}
                >
                  <option value="">Select…</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {fullName(e)} ({e.employee_code})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-slate-600">
                To (new title, from masters)
                <select
                  value={designationId}
                  onChange={(e) => setDesignationId(e.target.value)}
                  disabled={saving}
                  className={selectClass}
                >
                  <option value="">Select…</option>
                  {toOptions(designations).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-slate-600">
                To (new level, from masters)
                <select
                  value={levelId}
                  onChange={(e) => setLevelId(e.target.value)}
                  disabled={saving}
                  className={selectClass}
                >
                  <option value="">Select…</option>
                  {toOptions(levels).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-slate-600">
                To (new grade, from masters)
                <select
                  value={gradeId}
                  onChange={(e) => setGradeId(e.target.value)}
                  disabled={saving}
                  className={selectClass}
                >
                  <option value="">Select…</option>
                  {toOptions(grades).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-slate-600">
                Effective date
                <input
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  disabled={saving}
                  className={selectClass}
                />
              </label>
            </div>
            <div className="mt-5 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={saving}
                className="px-4 py-2 text-sm font-semibold rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={saving}
                className="px-4 py-2 text-sm font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Log promotion'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
