'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '@/lib/auth/useAuth';
import {
  fullName,
  orgApi,
  type NamedEntity,
  type OrgEmployee,
  type Position,
} from '@/lib/api/org';
import {
  ORG_CHANGE_TYPE_LABELS,
  orgChangesApi,
  type OrgChange,
} from '@/lib/api/orgchanges';
import { PageHeader, StatusPill } from '@/components/org-module/ui';

const UNASSIGNED = 'Unassigned';

const POSITION_STATUSES = ['filled', 'vacant', 'hiring', 'on_hold'] as const;

const POSITION_LABELS: Record<string, string> = {
  filled: 'Filled',
  vacant: 'Vacant',
  hiring: 'Hiring',
  on_hold: 'On Hold',
};

const positionColors: Record<string, string> = {
  Filled: 'bg-emerald-500',
  Vacant: 'bg-rose-500',
  Hiring: 'bg-indigo-500',
  'On Hold': 'bg-amber-500',
};

const CHANGE_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  effective: 'Effective',
  cancelled: 'Cancelled',
};

function groupByDepartment(employees: OrgEmployee[], departments: NamedEntity[]) {
  const names = new Map(departments.map((d) => [d.id, d.name]));
  const counts = new Map<string, number>();
  for (const e of employees) {
    const key = (e.department_id && names.get(e.department_id)) || UNASSIGNED;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([department, headcount]) => ({ department, headcount }))
    .sort((a, b) => b.headcount - a.headcount);
}

function groupByLocation(employees: OrgEmployee[], locations: NamedEntity[]) {
  const names = new Map(locations.map((l) => [l.id, l.name]));
  const counts = new Map<string, number>();
  for (const e of employees) {
    const key = (e.location_id && names.get(e.location_id)) || UNASSIGNED;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([location, headcount]) => ({ location, headcount }))
    .sort((a, b) => b.headcount - a.headcount);
}

/** Compact a from/to payload ({department: 'X'} or a scalar) for one line. */
function changeSide(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') {
    const parts = Object.values(value as Record<string, unknown>)
      .map((v) => (v === null || v === undefined ? '' : String(v)))
      .filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : '—';
  }
  return String(value);
}

function changeSummary(c: OrgChange): string {
  const fromEntries = Object.entries(c.from_data ?? {});
  const toEntries = Object.entries(c.to_data ?? {});
  // Prefer a shared key (e.g. department -> department) for a clean A -> B.
  const shared = toEntries.map(([k]) => k).find((k) => k in (c.from_data ?? {}));
  if (shared) {
    const from = (c.from_data as Record<string, unknown>)[shared];
    const to = (c.to_data as Record<string, unknown>)[shared];
    return `${changeSide(from)} → ${changeSide(to)}`;
  }
  const from = fromEntries.length > 0 ? changeSide(Object.fromEntries(fromEntries)) : '—';
  const to = toEntries.length > 0 ? changeSide(Object.fromEntries(toEntries)) : '—';
  return `${from} → ${to}`;
}

export default function OrgOverviewPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('org.manage') || hasPermission('employees.write');

  const [employees, setEmployees] = useState<OrgEmployee[] | null>(null);
  const [departments, setDepartments] = useState<NamedEntity[] | null>(null);
  const [locations, setLocations] = useState<NamedEntity[] | null>(null);
  const [positions, setPositions] = useState<Position[] | null>(null);
  const [changes, setChanges] = useState<OrgChange[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const [emps, depts, locs, poss, chgs] = await Promise.all([
        orgApi.listEmployees(),
        orgApi.listDepartments(),
        orgApi.listLocations(),
        orgApi.listPositions(),
        orgChangesApi.list(),
      ]);
      setEmployees(emps);
      setDepartments(depts);
      setLocations(locs);
      setPositions(poss);
      setChanges(chgs);
    } catch {
      setEmployees(null);
      setDepartments(null);
      setLocations(null);
      setPositions(null);
      setChanges(null);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const live = employees !== null && departments !== null && locations !== null;
  const positionsLive = positions !== null;
  const changesLive = changes !== null;

  const employeeNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of employees ?? []) map.set(e.id, fullName(e));
    return map;
  }, [employees]);

  const totalEmployees = employees?.length ?? 0;
  const deptCount = departments?.length ?? 0;
  const locCount = locations?.length ?? 0;
  const totalPositions = positions?.length ?? 0;
  const vacantPositions =
    positions?.filter((p) => p.status === 'vacant').length ?? 0;

  const headcountByDepartment = useMemo(
    () => (live ? groupByDepartment(employees, departments) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [live, employees, departments],
  );

  const locationSummary = useMemo(
    () => (live ? groupByLocation(employees, locations) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [live, employees, locations],
  );

  const exitedCount = useMemo(
    () => (live ? employees.filter((e) => e.date_of_exit).length : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [live, employees],
  );

  const positionBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of POSITION_STATUSES) counts.set(s, 0);
    for (const p of positions ?? []) {
      counts.set(p.status, (counts.get(p.status) ?? 0) + 1);
    }
    return POSITION_STATUSES.map((s) => ({
      status: POSITION_LABELS[s],
      count: counts.get(s) ?? 0,
    }));
  }, [positions]);

  const recentChanges = useMemo(() => {
    if (!changes) return [];
    return [...changes]
      .sort((a, b) => {
        const byEffective = (b.effective_date ?? '').localeCompare(a.effective_date ?? '');
        if (byEffective !== 0) return byEffective;
        return (b.created_at ?? '').localeCompare(a.created_at ?? '');
      })
      .slice(0, 6);
  }, [changes]);

  const kpis = [
    { label: 'Total Employees', value: totalEmployees },
    { label: 'Departments', value: deptCount },
    { label: 'Locations', value: locCount },
    { label: 'Total Positions', value: totalPositions },
    { label: 'Vacant Positions', value: vacantPositions },
  ];

  const quickActions = [
    {
      label: 'View organisation chart',
      href: '/org?tab=chart',
      gated: false,
    },
    {
      label: 'Manage departments',
      href: '/org-module/departments',
      gated: true,
    },
    {
      label: 'Manage teams',
      href: '/org-module/teams',
      gated: true,
    },
    {
      label: 'Review org changes',
      href: '/org-module/promotions',
      gated: false,
    },
  ];
  const visibleActions = quickActions.filter((a) => !a.gated || canManage);

  return (
    <div>
      <PageHeader
        title="Org Overview"
        subtitle="Live headcount, positions and recent changes from the organisation masters."
      />

      {loadFailed ? (
        <div
          role="alert"
          className="mb-4 flex items-center justify-between gap-3 flex-wrap bg-amber-50 border border-amber-200 rounded-xl px-4 py-3"
        >
          <p className="text-sm text-amber-800">
            Couldn&apos;t reach the organisation data — nothing is shown. Check your
            connection and retry.
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

      {/* KPI cards */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4" aria-label="Loading">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 animate-pulse">
              <div className="h-3 w-20 bg-slate-100 rounded" />
              <div className="mt-2 h-7 w-12 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {kpis.map((k) => (
            <div key={k.label} className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{k.label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{k.value}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Live</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Headcount by department */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-slate-900">Headcount by Department</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {loading
              ? 'Loading…'
              : 'Live from the employee directory'}
            {!loading && exitedCount > 0 ? ` · ${exitedCount} exited (have an exit date)` : ''}
          </p>
          {loading ? (
            <div className="mt-3 h-64 bg-slate-50 rounded-xl animate-pulse" />
          ) : headcountByDepartment.length === 0 ? (
            <p className="mt-3 py-12 text-center text-sm text-slate-500">
              No employees in the directory yet.
            </p>
          ) : (
            <div className="mt-3 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={headcountByDepartment} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="department" tick={{ fontSize: 11 }} interval={0} angle={-18} dy={10} height={52} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="headcount" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Position status */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-slate-900">Position Status</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {loading
              ? 'Loading…'
              : positionsLive && totalPositions > 0
                ? `A position exists even when vacant — ${totalPositions} positions in total. Live.`
                : 'No positions defined yet.'}
          </p>
          {loading ? (
            <div className="mt-4 space-y-3 animate-pulse">
              <div className="h-8 bg-slate-50 rounded" />
              <div className="h-8 bg-slate-50 rounded" />
              <div className="h-8 bg-slate-50 rounded" />
            </div>
          ) : totalPositions === 0 ? (
            <p className="mt-4 py-8 text-center text-sm text-slate-500">
              No positions yet —{' '}
              <Link href="/org-module/positions" className="font-semibold text-indigo-600 hover:text-indigo-700">
                add positions
              </Link>{' '}
              to track vacancies.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {positionBreakdown.map((p) => (
                <li key={p.status}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{p.status}</span>
                    <span className="font-bold text-slate-900">{p.count}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${positionColors[p.status] ?? 'bg-slate-400'}`}
                      style={{ width: `${Math.round((p.count / totalPositions) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-5">
            <h4 className="text-sm font-bold text-slate-900">Locations</h4>
            {loading ? (
              <div className="mt-2 space-y-2 animate-pulse">
                <div className="h-4 bg-slate-100 rounded" />
                <div className="h-4 bg-slate-100 rounded" />
              </div>
            ) : locationSummary.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No locations yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-slate-100">
                {locationSummary.map((l) => (
                  <li key={l.location} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-slate-700">{l.location}</span>
                    <span className="font-semibold text-slate-900">{l.headcount}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent org changes */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Recent Org Changes</h3>
            <Link
              href="/org-module/promotions"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              View all
            </Link>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {loading ? 'Loading…' : 'Latest effective-dated changes. Live.'}
          </p>
          {loading ? (
            <div className="mt-3 space-y-3 animate-pulse">
              <div className="h-16 bg-slate-50 rounded-xl" />
              <div className="h-16 bg-slate-50 rounded-xl" />
            </div>
          ) : !changesLive || recentChanges.length === 0 ? (
            <p className="mt-3 py-8 text-center text-sm text-slate-500">
              No org changes recorded yet.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {recentChanges.map((c) => (
                <li key={c.id} className="border border-slate-100 rounded-xl p-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-900">
                      {employeeNames.get(c.employee_id) ?? 'Employee'}
                    </p>
                    <StatusPill value={CHANGE_STATUS_LABELS[c.status] ?? c.status} />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {ORG_CHANGE_TYPE_LABELS[c.change_type] ?? c.change_type} · {changeSummary(c)} ·
                    effective {c.effective_date}
                    {c.changed_by_id ? ` · by ${c.changed_by_id}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Quick actions */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 h-max">
          <h3 className="text-sm font-bold text-slate-900">Quick Actions</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {canManage
              ? 'Actions run against live organisation data.'
              : 'Some actions need org management access.'}
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {visibleActions.map((a) => (
              <Link
                key={a.href + a.label}
                href={a.href}
                className="px-4 py-2.5 text-sm font-semibold rounded-xl bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                {a.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
