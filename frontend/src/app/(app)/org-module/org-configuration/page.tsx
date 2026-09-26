'use client';

import { useCallback, useEffect, useState } from 'react';
import { orgApi, type NamedEntity, type OrgEmployee, type Position, type Team } from '@/lib/api/org';
import { orgChangesApi, type OrgChange } from '@/lib/api/orgchanges';
import { PageHeader } from '@/components/org-module/ui';

function RetryBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="mb-4 flex items-center justify-between gap-3 flex-wrap bg-amber-50 border border-amber-200 rounded-xl px-4 py-3"
    >
      <p className="text-sm text-amber-800">
        Couldn&apos;t reach the organisation data — nothing is shown. Check your connection and retry.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
      >
        Retry
      </button>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 animate-pulse" aria-label="Loading">
      <div className="h-4 w-1/3 bg-slate-100 rounded" />
      <div className="mt-3 space-y-2">
        <div className="h-8 bg-slate-50 rounded" />
        <div className="h-8 bg-slate-50 rounded" />
        <div className="h-8 bg-slate-50 rounded" />
      </div>
    </div>
  );
}

export default function OrgConfigurationPage() {
  const [legalEntities, setLegalEntities] = useState<NamedEntity[] | null>(null);
  const [businessUnits, setBusinessUnits] = useState<NamedEntity[] | null>(null);
  const [locations, setLocations] = useState<NamedEntity[] | null>(null);
  const [departments, setDepartments] = useState<NamedEntity[] | null>(null);
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [positions, setPositions] = useState<Position[] | null>(null);
  const [employees, setEmployees] = useState<OrgEmployee[] | null>(null);
  const [changes, setChanges] = useState<OrgChange[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const [les, bus, locs, depts, tms, poss, emps, chgs] = await Promise.all([
        orgApi.listLegalEntities(),
        orgApi.listBusinessUnits(),
        orgApi.listLocations(),
        orgApi.listDepartments(),
        orgApi.listTeams(),
        orgApi.listPositions(),
        orgApi.listEmployees(),
        orgChangesApi.list(),
      ]);
      setLegalEntities(les);
      setBusinessUnits(bus);
      setLocations(locs);
      setDepartments(depts);
      setTeams(tms);
      setPositions(poss);
      setEmployees(emps);
      setChanges(chgs);
    } catch {
      setLegalEntities(null);
      setBusinessUnits(null);
      setLocations(null);
      setDepartments(null);
      setTeams(null);
      setPositions(null);
      setEmployees(null);
      setChanges(null);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const defaultLegalEntity =
    [...(legalEntities ?? [])].sort((a, b) => a.name.localeCompare(b.name))[0]?.name ?? '—';

  const effectiveChanges = (changes ?? []).filter((c) => c.status === 'effective').length;
  const pendingChanges = (changes ?? []).filter((c) => c.status === 'pending').length;

  const rows: Array<[string, number]> = [
    ['Legal entities', legalEntities?.length ?? 0],
    ['Business units', businessUnits?.length ?? 0],
    ['Locations', locations?.length ?? 0],
    ['Departments', departments?.length ?? 0],
    ['Teams', teams?.length ?? 0],
    ['Positions', positions?.length ?? 0],
    ['Employees', employees?.length ?? 0],
  ];

  return (
    <div>
      <PageHeader
        title="Org Configuration"
        subtitle="Current effective conventions, read from live organisation data. Read-only — there is no stored configuration to edit."
      />

      {loadFailed ? <RetryBanner onRetry={refresh} /> : null}

      {loading ? (
        <div className="max-w-2xl space-y-4">
          <Skeleton />
        </div>
      ) : (
        <div className="max-w-2xl space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900">Hierarchy configuration</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Legal entity → BU → location / department → team → position → employee
              </p>
            </div>
            <dl className="px-5 py-4 divide-y divide-slate-100">
              {rows.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between py-2 text-sm">
                  <dt className="text-slate-600">{label}</dt>
                  <dd className="font-bold text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900">Effective conventions</h3>
              <p className="text-xs text-slate-500 mt-0.5">Observed from live data, not stored settings.</p>
            </div>
            <dl className="px-5 py-4 divide-y divide-slate-100">
              <div className="flex items-center justify-between py-2 text-sm gap-4">
                <dt className="text-slate-600">Default legal entity (first alphabetically)</dt>
                <dd className="font-semibold text-slate-900 text-right">{defaultLegalEntity}</dd>
              </div>
              <div className="flex items-center justify-between py-2 text-sm gap-4">
                <dt className="text-slate-600">Effective-dated changes</dt>
                <dd className="font-semibold text-slate-900 text-right">
                  Enabled — {effectiveChanges} effective · {pendingChanges} pending
                </dd>
              </div>
              <div className="flex items-center justify-between py-2 text-sm gap-4">
                <dt className="text-slate-600">Positions tracked independently of employees</dt>
                <dd className="font-semibold text-slate-900 text-right">
                  Yes — {positions?.length ?? 0} positions
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
