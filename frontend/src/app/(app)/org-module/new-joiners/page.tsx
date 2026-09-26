'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth/useAuth';
import { orgApi, type NamedEntity } from '@/lib/api/org';
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

async function api<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: 'include' });
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

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function NewJoinersPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('org.manage') || hasPermission('employees.write');
  const [group, setGroup] = useState<'Upcoming' | 'Recent'>('Upcoming');
  const [search, setSearch] = useState('');
  const [records, setRecords] = useState<OnboardingRecord[]>([]);
  const [departments, setDepartments] = useState<NamedEntity[]>([]);
  const [designations, setDesignations] = useState<NamedEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const [recs, depts, desigs] = await Promise.all([
        api<OnboardingRecord[]>('/api/onboarding/records'),
        orgApi.listDepartments(),
        orgApi.listDesignations(),
      ]);
      setRecords(recs);
      setDepartments(depts);
      setDesignations(desigs);
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

  const upcoming = useMemo(() => records.filter((r) => r.joining_date >= today()), [records]);
  const recent = useMemo(() => records.filter((r) => r.joining_date < today()), [records]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = group === 'Upcoming' ? upcoming : recent;
    if (!q) return base;
    return base.filter((r) =>
      [r.employee.name, r.employee.employee_code, r.joining_date]
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [group, search, upcoming, recent]);

  return (
    <div>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <PageHeader
          title="New Joiners"
          subtitle="Day-one joiners moving into onboarding."
        />
        {canManage ? (
          <a
            href="/org-module/preboarding"
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          >
            Add joiner
          </a>
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

      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex gap-2">
            {(['Upcoming', 'Recent'] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGroup(g)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                  group === g
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {g} ({g === 'Upcoming' ? upcoming.length : recent.length})
              </button>
            ))}
          </div>
          <div className="min-w-[200px] flex-1 max-w-md">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, code or joining date…"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400"
            />
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <h3 className="text-sm font-bold text-slate-900">New joiners</h3>
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
          <p className="px-5 py-12 text-center text-sm text-slate-500">No joiners in this group.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Joiner', 'Joining date', 'Position', 'Department', 'Stage', 'Checklist'].map((h) => (
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
                    <td className="px-5 py-3">
                      <StatusPill value={r.stage} />
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-700">
                      {r.progress.completed}/{r.progress.total} ({r.progress.percent}%)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
