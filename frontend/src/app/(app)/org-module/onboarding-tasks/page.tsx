'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/useAuth';
import { PageHeader, StatusPill } from '@/components/org-module/ui';

interface TaskTemplate {
  id: number;
  category: string;
  title: string;
  description?: string;
  owner: string;
  is_required: boolean;
  requires_document: boolean;
  offset_days: number;
  sort_order: number;
  is_active: boolean;
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

const CATEGORIES = ['preboarding', 'onboarding'];
const OWNERS = ['new_hire', 'hr_admin', 'manager', 'buddy'];

export default function OnboardingTasksPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('org.manage') || hasPermission('employees.write');

  const [rows, setRows] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [search, setSearch] = useState('');

  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    category: 'onboarding',
    owner: 'hr_admin',
    description: '',
    offset_days: '0',
    is_required: true,
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const list = await api<TaskTemplate[]>('/api/onboarding/templates');
      setRows(list);
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

  const q = search.trim().toLowerCase();
  const visible = rows.filter((r) =>
    q ? [r.title, r.category, r.owner].join(' ').toLowerCase().includes(q) : true,
  );

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setFormError(null);
    if (!form.title.trim()) {
      setFormError('Give the template a title.');
      return;
    }
    setSaving(true);
    try {
      await api('/api/onboarding/templates', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title.trim(),
          category: form.category,
          owner: form.owner,
          description: form.description.trim(),
          offset_days: Number(form.offset_days) || 0,
          is_required: form.is_required,
        }),
      });
      setShowAdd(false);
      setForm({
        title: '',
        category: 'onboarding',
        owner: 'hr_admin',
        description: '',
        offset_days: '0',
        is_required: true,
      });
      await refresh();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not add the template.');
    } finally {
      setSaving(false);
    }
  };

  const selectClass =
    'mt-1 block w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-slate-300 disabled:opacity-60';

  return (
    <div>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <PageHeader
          title="Tasks / Templates"
          subtitle="Reusable onboarding checklists by category — new hires get a copy of every active template."
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
            Add template
          </button>
        ) : null}
      </div>

      {loadFailed ? (
        <div className="mb-4 flex items-center justify-between gap-3 flex-wrap bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-sm text-amber-800">
            Couldn&apos;t load templates — template management is HR Admin only.
          </p>
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
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, category or owner…"
          className="w-full max-w-md px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <h3 className="text-sm font-bold text-slate-900">Templates</h3>
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
          <p className="px-5 py-12 text-center text-sm text-slate-500">No templates match.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Template', 'Category', 'Owner role', 'Required', 'Due offset (days)'].map((h) => (
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
                      {r.title}
                      {r.description ? (
                        <span className="block text-xs font-normal text-slate-500">
                          {r.description}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-5 py-3">
                      <StatusPill value={r.category} />
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-700">{r.owner}</td>
                    <td className="px-5 py-3 text-sm text-slate-700">
                      {r.is_required ? 'Yes' : 'No'}
                      {r.requires_document ? ' · doc' : ''}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-700">
                      {r.offset_days === 0 ? 'Day 1' : `Day ${r.offset_days > 0 ? '+' : ''}${r.offset_days}`}
                    </td>
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
          aria-label="Add template"
        >
          <div
            className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-lg p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold text-slate-900">Add template</h3>
            {formError ? (
              <p className="mt-2 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                {formError}
              </p>
            ) : null}
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-medium text-slate-600">
                Template name
                <input
                  type="text"
                  value={form.title}
                  onChange={set('title')}
                  disabled={saving}
                  placeholder="e.g. Day-one HR checklist"
                  className={selectClass}
                />
              </label>
              <label className="block text-xs font-medium text-slate-600">
                Category
                <select value={form.category} onChange={set('category')} disabled={saving} className={selectClass}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-slate-600">
                Owner role
                <select value={form.owner} onChange={set('owner')} disabled={saving} className={selectClass}>
                  {OWNERS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-slate-600">
                Due offset (days from joining; 0 = Day 1, negative = before)
                <input
                  type="number"
                  value={form.offset_days}
                  onChange={set('offset_days')}
                  disabled={saving}
                  className={selectClass}
                />
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <input
                  type="checkbox"
                  checked={form.is_required}
                  onChange={(e) => setForm((f) => ({ ...f, is_required: e.target.checked }))}
                  disabled={saving}
                />
                Required for completion
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
                {saving ? 'Saving…' : 'Add template'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
