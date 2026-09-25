'use client';

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
  departments,
  headcountByDepartment,
  locations,
  locationSummary,
  positionSummary,
  recentOrgChanges,
  totalEmployees,
  totalPositions,
  vacantPositions,
} from '@/lib/mock/org/data';
import { PageHeader, StatusPill } from '@/components/org-module/ui';

const positionColors: Record<string, string> = {
  Filled: 'bg-emerald-500',
  Vacant: 'bg-rose-500',
  Hiring: 'bg-indigo-500',
  'On Hold': 'bg-amber-500',
};

export default function OrgOverviewPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('org.manage') || hasPermission('employees.write');

  const kpis = [
    { label: 'Total Employees', value: totalEmployees },
    { label: 'Departments', value: departments.length },
    { label: 'Locations', value: locations.length },
    { label: 'Total Positions', value: totalPositions },
    { label: 'Vacant Positions', value: vacantPositions },
  ];

  const quickActions = [
    { label: 'View organisation chart', href: '/org?tab=chart' },
    { label: 'Manage departments', href: '/org-module/departments' },
    { label: 'Manage teams', href: '/org-module/teams' },
    { label: 'Review org changes', href: '/org-module/promotions' },
  ];

  return (
    <div>
      <PageHeader
        title="Org Overview"
        subtitle="Headcount, structure and recent changes across the organisation (mock data)."
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{k.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Headcount by department */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-slate-900">Headcount by Department</h3>
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
        </div>

        {/* Position status */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-slate-900">Position Status</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            A position exists even when vacant — {totalPositions} positions in total.
          </p>
          <ul className="mt-4 space-y-3">
            {positionSummary.map((p) => (
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
          <div className="mt-5">
            <h4 className="text-sm font-bold text-slate-900">Locations</h4>
            <ul className="mt-2 divide-y divide-slate-100">
              {locationSummary.map((l) => (
                <li key={l.location} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-slate-700">{l.location}</span>
                  <span className="font-semibold text-slate-900">{l.headcount}</span>
                </li>
              ))}
            </ul>
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
          <ul className="mt-3 space-y-3">
            {recentOrgChanges.map((c) => (
              <li key={c.id} className="border border-slate-100 rounded-xl p-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-slate-900">{c.subject}</p>
                  <StatusPill value={c.status} />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {c.type} · {c.from} → {c.to} · effective {c.effectiveDate} · by {c.changedBy}
                </p>
              </li>
            ))}
          </ul>
        </div>

        {/* Quick actions */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 h-max">
          <h3 className="text-sm font-bold text-slate-900">Quick Actions</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {canManage
              ? 'Actions run against mock data — nothing is saved.'
              : 'Some actions need org management access.'}
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {quickActions.map((a) => (
              <Link
                key={a.href + a.label}
                href={a.href}
                className="px-4 py-2.5 text-sm font-semibold rounded-xl bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors text-center"
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
