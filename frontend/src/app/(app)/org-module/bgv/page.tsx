'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader, StatusPill } from '@/components/org-module/ui';

interface OnboardingRecord {
  id: number;
  employee: { id: number | string; name: string; employee_code: string };
  stage: string;
  joining_date: string;
}

interface Bgv {
  status: string;
  status_display?: string;
  notes?: string | null;
  document_count?: number;
  documents_submitted?: number;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
}

interface BgvRow {
  record: OnboardingRecord;
  bgv: Bgv | null;
  forbidden: boolean;
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
    const err = new Error(
      (() => {
        const raw = json?.error?.message;
        return Array.isArray(raw) ? raw.join(', ') : raw || `Request failed (${res.status})`;
      })(),
    ) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return json.data as T;
}

export default function BgvPage() {
  const [rows, setRows] = useState<BgvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const records = await api<OnboardingRecord[]>('/api/onboarding/records');
      const settled = await Promise.allSettled(
        records.map((r) =>
          api<Bgv>(`/api/onboarding/records/${r.id}/background-verification`),
        ),
      );
      setRows(
        records.map((record, i) => {
          const s = settled[i];
          if (s.status === 'fulfilled') return { record, bgv: s.value, forbidden: false };
          const status = (s.reason as Error & { status?: number })?.status;
          return { record, bgv: null, forbidden: status === 403 };
        }),
      );
    } catch {
      setRows([]);
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
    return rows.filter(({ record, bgv }) => {
      if (statusFilter && (bgv?.status ?? '') !== statusFilter) return false;
      if (!q) return true;
      return [record.employee.name, record.employee.employee_code]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [rows, search, statusFilter]);

  const restricted = rows.length > 0 && rows.every((r) => r.bgv === null && r.forbidden);

  const decide = async (id: number, status: 'passed' | 'failed') => {
    setNotice(null);
    try {
      await api(`/api/onboarding/records/${id}/background-verification`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not record the decision.');
    }
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <PageHeader
          title="Background Verification"
          subtitle="Verification cases per onboarding record — HR Admin only."
        />
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

      {restricted ? (
        <div className="mb-4 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
          <p className="text-sm text-slate-600">
            Background verification details are visible to HR Admins only.
          </p>
        </div>
      ) : null}

      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1 max-w-md">
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
              Search
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by candidate…"
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
              {['not_started', 'pending_documents', 'ready_for_review', 'passed', 'failed'].map((s) => (
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
          <h3 className="text-sm font-bold text-slate-900">Verification cases</h3>
          <span className="text-xs text-slate-500">
            Showing {visible.length} of {rows.length}
          </span>
        </div>
        {loading ? (
          <div className="p-5 animate-pulse space-y-2">
            <div className="h-8 bg-slate-50 rounded" />
            <div className="h-8 bg-slate-50 rounded" />
            <div className="h-8 bg-slate-50 rounded" />
          </div>
        ) : visible.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-slate-500">No cases match.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Candidate', 'Joining', 'Status', 'Documents', 'Reviewed by', 'Decision'].map((h) => (
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
                {visible.map(({ record, bgv, forbidden }) => (
                  <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 text-sm font-semibold text-slate-900">
                      {record.employee.name}
                      <span className="block text-xs font-normal text-slate-500">
                        {record.employee.employee_code}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-700">{record.joining_date}</td>
                    <td className="px-5 py-3">
                      {bgv ? (
                        <StatusPill value={bgv.status_display ?? bgv.status} />
                      ) : (
                        <span className="text-xs text-slate-500">
                          {forbidden ? 'Restricted' : '—'}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-700">
                      {bgv?.document_count !== undefined
                        ? `${bgv.documents_submitted ?? 0}/${bgv.document_count}`
                        : '—'}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-700">
                      {bgv?.reviewed_by_name ?? '—'}
                    </td>
                    <td className="px-5 py-3">
                      {bgv && bgv.status !== 'passed' && bgv.status !== 'failed' ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => decide(record.id, 'passed')}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                          >
                            Pass
                          </button>
                          <button
                            type="button"
                            onClick={() => decide(record.id, 'failed')}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            Fail
                          </button>
                        </div>
                      ) : null}
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

