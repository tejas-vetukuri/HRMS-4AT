'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth/useAuth';
import { fullName, orgApi, type NamedEntity, type OrgEmployee } from '@/lib/api/org';
import { PageHeader, StatusPill } from '@/components/org-module/ui';

interface OnboardingEmployee {
  id: number | string;
  name: string;
  employee_code: string;
  department_id?: number | string | null;
  designation_id?: number | string | null;
}

interface OnboardingRecord {
  id: number;
  employee: OnboardingEmployee;
  stage: string;
  joining_date: string;
  employee_status: string;
  progress: { completed: number; total: number; percent: number };
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { message?: string | string[] };
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  let json: ApiEnvelope<T> | null = null;
  try {
    json = (await res.json()) as ApiEnvelope<T>;
  } catch {
    json = null;
  }
  if (!res.ok || !json?.success) {
    const raw = json?.error?.message;
    throw new Error(
      Array.isArray(raw) ? raw.join(', ') : raw || `Request failed (${res.status})`,
    );
  }
  return json.data as T;
}

function nameOf(entities: NamedEntity[], id: unknown): string {
  if (id === null || id === undefined || id === '') return '—';
  return entities.find((e) => String(e.id) === String(id))?.name ?? '—';
}

type Stage = 'Offer' | 'Accepted' | 'Ready for Day 1' | 'All';

export default function PreboardingPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('org.manage') || hasPermission('employees.write');

  const [records, setRecords] = useState<OnboardingRecord[]>([]);
  const [departments, setDepartments] = useState<NamedEntity[]>([]);
  const [designations, setDesignations] = useState<NamedEntity[]>([]);
  const [employees, setEmployees] = useState<OrgEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [stage, setStage] = useState<Stage>('All');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    work_email: '',
    personal_email: '',
    phone: '',
    joining_date: '',
    department_id: '',
    designation_id: '',
    manager_id: '',
    buddy_id: '',
    basic_salary: '',
    employment_type: 'full_time',
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const [recs, depts, desigs, emps] = await Promise.all([
        api<OnboardingRecord[]>('/api/onboarding/records?stage=preboarding'),
        orgApi.listDepartments(),
        orgApi.listDesignations(),
        orgApi.listEmployees(),
      ]);
      setRecords(recs);
      setDepartments(depts);
      setDesignations(desigs);
      setEmployees(emps);
    } catch {
      setRecords([]);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      if (stage === 'Ready for Day 1' && r.progress.percent < 100) return false;
      if (stage === 'Offer' && r.progress.percent !== 0) return false;
      if (stage === 'Accepted' && (r.progress.percent === 0 || r.progress.percent >= 100))
        return false;
      if (!q) return true;
      return [r.employee.name, r.employee.employee_code, r.joining_date]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [records, stage, search]);

  const counts = useMemo(
    () => ({
      Offer: records.filter((r) => r.progress.percent === 0).length,
      Accepted: records.filter((r) => r.progress.percent > 0 && r.progress.percent < 100).length,
      'Ready for Day 1': records.filter((r) => r.progress.percent >= 100).length,
    }),
    [records],
  );

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setFormError(null);
    for (const k of ['first_name', 'last_name', 'work_email', 'personal_email', 'joining_date'] as const) {
      if (!form[k].trim()) {
        setFormError('Name, work email, personal email and joining date are required.');
        return;
      }
    }
    const basic = Number(form.basic_salary);
    if (!Number.isFinite(basic) || basic <= 0) {
      setFormError('Enter an annual basic salary greater than 0.');
      return;
    }
    const payload: Record<string, unknown> = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      work_email: form.work_email.trim().toLowerCase(),
      personal_email: form.personal_email.trim(),
      phone: form.phone.trim(),
      joining_date: form.joining_date,
      basic_salary: basic,
      employment_type: form.employment_type,
    };
    if (form.department_id) payload.department_id = form.department_id;
    if (form.designation_id) payload.designation_id = form.designation_id;
    if (form.manager_id) payload.manager_id = form.manager_id;
    if (form.buddy_id) payload.buddy_id = form.buddy_id;
    setSaving(true);
    try {
      await api('/api/onboarding/records', { method: 'POST', body: JSON.stringify(payload) });
      setShowAdd(false);
      setForm({
        first_name: '',
        last_name: '',
        work_email: '',
        personal_email: '',
        phone: '',
        joining_date: '',
        department_id: '',
        designation_id: '',
        manager_id: '',
        buddy_id: '',
        basic_salary: '',
        employment_type: 'full_time',
      });
      await refresh();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not add the candidate.');
    } finally {
      setSaving(false);
    }
  };

  const activate = async (id: number) => {
    setNotice(null);
    try {
      await api(`/api/onboarding/records/${id}/activate`, { method: 'POST' });
      await refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not mark Day 1.');
    }
  };

  const selectClass =
    'mt-1 block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-slate-300 disabled:opacity-60';
  const inputClass = selectClass;

  return (
    <div>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <PageHeader
          title="Preboarding"
          subtitle="Candidates between offer and day one, by stage."
        />
        {canManage ? (
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setShowAdd(true);
            }}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          >
            Add candidate
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

      {notice ? (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-sm text-amber-800">{notice}</p>
        </div>
      ) : null}

      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4">
        <div className="flex flex-wrap gap-2">
          {(['All', 'Offer', 'Accepted', 'Ready for Day 1'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStage(s)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                stage === s
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {s}
              {s !== 'All' ? ` (${counts[s] ?? 0})` : ` (${records.length})`}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, code or joining date…"
            className="w-full max-w-md px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400"
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <h3 className="text-sm font-bold text-slate-900">Candidates</h3>
          <span className="text-xs text-slate-500">
            Showing {visible.length} of {records.length}
          </span>
        </div>
        {loading ? (
          <div className="p-5 animate-pulse space-y-2">
            <div className="h-8 bg-slate-50 rounded" />
            <div className="h-8 bg-slate-50 rounded" />
            <div className="h-8 bg-slate-50 rounded" />
          </div>
        ) : visible.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-slate-500">No candidates in this stage.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Candidate', 'DOJ', 'Position', 'Org assignment', 'Checklist', 'Stage', ...(canManage ? ['Actions'] : [])].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 text-sm font-semibold text-slate-900">
                      {r.employee.name}
                      <span className="block text-xs font-normal text-slate-500">
                        {r.employee.employee_code}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-700">{r.joining_date}</td>
                    <td className="px-5 py-3 text-sm text-slate-700">
                      {nameOf(designations, r.employee.designation_id)}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-700">
                      {nameOf(departments, r.employee.department_id)}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-700">
                      {r.progress.completed}/{r.progress.total} ({r.progress.percent}%)
                    </td>
                    <td className="px-5 py-3">
                      <StatusPill value={r.stage} />
                    </td>
                    {canManage ? (
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          onClick={() => activate(r.id)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          Mark Day 1
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAdd ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => (!saving ? setShowAdd(false) : undefined)}
          role="dialog"
          aria-modal="true"
          aria-label="Add candidate"
        >
          <div
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-xl border border-slate-200 shadow-lg p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold text-slate-900">Add candidate</h3>
            <p className="mt-1 text-xs text-slate-500">
              Org assignment is picked from masters — no free-text roles or departments.
            </p>
            {formError ? (
              <p className="mt-2 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                {formError}
              </p>
            ) : null}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-xs font-medium text-slate-600">
                First name
                <input type="text" value={form.first_name} onChange={set('first_name')} disabled={saving} className={inputClass} />
              </label>
              <label className="block text-xs font-medium text-slate-600">
                Last name
                <input type="text" value={form.last_name} onChange={set('last_name')} disabled={saving} className={inputClass} />
              </label>
              <label className="block text-xs font-medium text-slate-600">
                Work email
                <input type="email" value={form.work_email} onChange={set('work_email')} disabled={saving} className={inputClass} />
              </label>
              <label className="block text-xs font-medium text-slate-600">
                Personal email
                <input type="email" value={form.personal_email} onChange={set('personal_email')} disabled={saving} className={inputClass} />
              </label>
              <label className="block text-xs font-medium text-slate-600">
                Phone
                <input type="text" value={form.phone} onChange={set('phone')} disabled={saving} className={inputClass} />
              </label>
              <label className="block text-xs font-medium text-slate-600">
                Date of joining
                <input type="date" value={form.joining_date} onChange={set('joining_date')} disabled={saving} className={inputClass} />
              </label>
              <label className="block text-xs font-medium text-slate-600">
                Department (from masters)
                <select value={form.department_id} onChange={set('department_id')} disabled={saving} className={selectClass}>
                  <option value="">Select…</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-slate-600">
                Title (from masters)
                <select value={form.designation_id} onChange={set('designation_id')} disabled={saving} className={selectClass}>
                  <option value="">Select…</option>
                  {designations.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-slate-600">
                Manager (from directory)
                <select value={form.manager_id} onChange={set('manager_id')} disabled={saving} className={selectClass}>
                  <option value="">Select…</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {fullName(e)} ({e.employee_code})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-slate-600">
                Buddy (from directory)
                <select value={form.buddy_id} onChange={set('buddy_id')} disabled={saving} className={selectClass}>
                  <option value="">Select…</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {fullName(e)} ({e.employee_code})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-slate-600">
                Annual basic salary (INR)
                <input type="number" min="1" value={form.basic_salary} onChange={set('basic_salary')} disabled={saving} className={inputClass} />
              </label>
              <label className="block text-xs font-medium text-slate-600">
                Employment type
                <select value={form.employment_type} onChange={set('employment_type')} disabled={saving} className={selectClass}>
                  <option value="full_time">Full-time</option>
                  <option value="contract">Contract</option>
                  <option value="intern">Intern</option>
                </select>
              </label>
            </div>
            <div className="mt-5 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
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
                {saving ? 'Saving…' : 'Add candidate'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
