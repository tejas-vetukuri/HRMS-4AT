'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { fullName, orgApi, type OrgEmployee, type Position, type Team } from '@/lib/api/org';
import { PageHeader } from '@/components/org-module/ui';

export default function HierarchyRulesPage() {
  const [employees, setEmployees] = useState<OrgEmployee[] | null>(null);
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [positions, setPositions] = useState<Position[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const [emps, tms, poss] = await Promise.all([
        orgApi.listEmployees(),
        orgApi.listTeams(),
        orgApi.listPositions(),
      ]);
      setEmployees(emps);
      setTeams(tms);
      setPositions(poss);
    } catch {
      setEmployees(null);
      setTeams(null);
      setPositions(null);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const stats = useMemo(() => {
    const emps = employees ?? [];
    const reports = new Map<string, number>();
    for (const e of emps) {
      if (e.manager_id) reports.set(e.manager_id, (reports.get(e.manager_id) ?? 0) + 1);
    }
    const topLevel = emps.filter((e) => !e.manager_id).length;
    const maxSpan = reports.size > 0 ? Math.max(...reports.values()) : 0;
    const names = new Map(emps.map((e) => [e.id, fullName(e)]));
    const widest = [...reports.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => ({ name: names.get(id) ?? id, count }));
    const teamsWithoutLead = (teams ?? []).filter((t) => !t.lead_id).length;
    const vacantOrHiring =
      (positions ?? []).filter((p) => p.status === 'vacant' || p.status === 'hiring').length;
    return { topLevel, maxSpan, widest, teamsWithoutLead, vacantOrHiring };
  }, [employees, teams, positions]);

  return (
    <div>
      <PageHeader
        title="Hierarchy Rules"
        subtitle="Span and reporting facts observed from live data. Read-only — these are measured, not configured."
      />

      {loadFailed ? (
        <div
          role="alert"
          className="mb-4 flex items-center justify-between gap-3 flex-wrap bg-amber-50 border border-amber-200 rounded-xl px-4 py-3"
        >
          <p className="text-sm text-amber-800">
            Couldn&apos;t reach the organisation data — nothing is shown. Check your connection and retry.
          </p>
          <button
            type="button"
            onClick={refresh}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            Retry
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-5 animate-pulse max-w-2xl" aria-label="Loading">
          <div className="h-4 w-1/3 bg-slate-100 rounded" />
          <div className="mt-3 space-y-2">
            <div className="h-8 bg-slate-50 rounded" />
            <div className="h-8 bg-slate-50 rounded" />
            <div className="h-8 bg-slate-50 rounded" />
          </div>
        </div>
      ) : (
        <div className="max-w-2xl space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900">Span & relationship rules</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Guardrails that hold today, measured from reporting lines, teams and positions.
              </p>
            </div>
            <dl className="px-5 py-4 divide-y divide-slate-100">
              <div className="flex items-center justify-between py-2 text-sm gap-4">
                <dt className="text-slate-600">Largest observed span of control</dt>
                <dd className="font-bold text-slate-900">{stats.maxSpan} direct reports</dd>
              </div>
              <div className="flex items-center justify-between py-2 text-sm gap-4">
                <dt className="text-slate-600">Employees with no manager (top level)</dt>
                <dd className="font-bold text-slate-900">{stats.topLevel}</dd>
              </div>
              <div className="flex items-center justify-between py-2 text-sm gap-4">
                <dt className="text-slate-600">Teams without a lead</dt>
                <dd className="font-bold text-slate-900">{stats.teamsWithoutLead}</dd>
              </div>
              <div className="flex items-center justify-between py-2 text-sm gap-4">
                <dt className="text-slate-600">Positions vacant or hiring</dt>
                <dd className="font-bold text-slate-900">{stats.vacantOrHiring}</dd>
              </div>
            </dl>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900">Widest spans</h3>
              <p className="text-xs text-slate-500 mt-0.5">Managers with the most direct reports.</p>
            </div>
            {stats.widest.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500">
                No reporting lines recorded yet.
              </p>
            ) : (
              <ul className="px-5 py-2 divide-y divide-slate-100">
                {stats.widest.map((w) => (
                  <li key={w.name} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-slate-700">{w.name}</span>
                    <span className="font-semibold text-slate-900">{w.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
