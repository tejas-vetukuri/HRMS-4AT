'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/useAuth';
import { PageHeader, StatusPill } from '@/components/org-module/ui';

interface Task {
  id: number;
  title: string;
  category: string;
  owner: string;
  status: string;
  is_required: boolean;
  due_date?: string | null;
}

interface OnboardingRecord {
  id: number;
  employee: { id: number | string; name: string; employee_code: string };
  stage: string;
  joining_date: string;
  progress: { completed: number; total: number; percent: number };
}

interface RecordDetail extends OnboardingRecord {
  tasks: Task[];
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

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
      <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${value}%` }} />
    </div>
  );
}

function taskStyle(status: string): string {
  if (status === 'done') return 'bg-emerald-100 text-emerald-700';
  if (status === 'in_progress') return 'bg-amber-100 text-amber-700';
  if (status === 'skipped') return 'bg-slate-200 text-slate-500';
  return 'bg-slate-100 text-slate-600';
}

export default function OnboardingPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('org.manage') || hasPermission('employees.write');

  const [records, setRecords] = useState<RecordDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const list = await api<OnboardingRecord[]>('/api/onboarding/records?stage=onboarding');
      const details = await Promise.all(
        list.map((r) => api<RecordDetail>(`/api/onboarding/records/${r.id}`)),
      );
      setRecords(details);
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

  const advance = async (taskId: number, status: string) => {
    setNotice(null);
    try {
      await api(`/api/onboarding/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not update the task.');
    }
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <PageHeader
          title="Onboarding"
          subtitle="New-joiner progress against checklists generated from templates."
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

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-5 animate-pulse space-y-2">
          <div className="h-8 bg-slate-50 rounded" />
          <div className="h-8 bg-slate-50 rounded" />
          <div className="h-8 bg-slate-50 rounded" />
        </div>
      ) : records.length === 0 ? (
        <p className="bg-white border border-slate-200 rounded-xl px-5 py-12 text-center text-sm text-slate-500">
          No joiners in onboarding right now.
        </p>
      ) : (
        <div className="space-y-4">
          {records.map((r) => (
            <div key={r.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      {r.employee.name}
                      <span className="ml-2 text-xs font-normal text-slate-500">
                        {r.employee.employee_code} · joining {r.joining_date}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      <StatusPill value={r.stage} />
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-slate-700">
                    {r.progress.percent}% complete ({r.progress.completed}/{r.progress.total} required)
                  </span>
                </div>
                <div className="mt-3">
                  <ProgressBar value={r.progress.percent} />
                </div>
              </div>
              <ul className="divide-y divide-slate-100">
                {(r.tasks ?? []).map((t) => (
                  <li
                    key={t.id}
                    className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{t.title}</p>
                      <p className="text-xs text-slate-500">
                        {t.category} · {t.owner}
                        {t.is_required ? ' · required' : ''}
                        {t.due_date ? ` · due ${t.due_date}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${taskStyle(t.status)}`}
                      >
                        {t.status}
                      </span>
                      {canManage && t.status !== 'done' ? (
                        <button
                          type="button"
                          onClick={() => advance(t.id, 'done')}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          Mark done
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
                {(r.tasks ?? []).length === 0 ? (
                  <li className="px-5 py-6 text-center text-sm text-slate-500">
                    No checklist tasks yet — they are generated when the offer is accepted.
                  </li>
                ) : null}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
