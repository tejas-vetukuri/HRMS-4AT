'use client';

import { useMemo, useState } from 'react';
import { STATUS_LABELS, fmtDate, fullName, type EmployeeRow, type EmployeeStatus } from '@/lib/admin/orgApi';
import { Badge, Button, Notice, Select } from '../ui';
import { nameMap, type Lookups } from './useOrgData';

export function EmployeesTab({
  employees,
  lookups,
  loading,
  error,
  canWrite,
  onOpen,
  noManagerOnly,
  onNoManagerOnly,
}: {
  employees: EmployeeRow[];
  lookups: Lookups;
  loading: boolean;
  error: string | null;
  canWrite: boolean;
  onOpen: (id: string | 'new') => void;
  noManagerOnly: boolean;
  onNoManagerOnly: (v: boolean) => void;
}) {
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState<'' | EmployeeStatus>('');

  const departments = useMemo(() => nameMap(lookups.departments), [lookups.departments]);
  const designations = useMemo(() => nameMap(lookups.designations), [lookups.designations]);
  const locations = useMemo(() => nameMap(lookups.locations), [lookups.locations]);
  const byId = useMemo(() => Object.fromEntries(employees.map((e) => [e.id, e])), [employees]);

  const noManager = employees.filter((e) => !e.manager_id && e.status !== 'exited').length;
  const noJoining = employees.filter((e) => !e.date_of_joining).length;

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return employees.filter((e) => {
      if (department && e.department_id !== department) return false;
      if (status && e.status !== status) return false;
      if (noManagerOnly && (e.manager_id || e.status === 'exited')) return false;
      if (!term) return true;
      return (
        fullName(e).toLowerCase().includes(term) ||
        e.employee_code.toLowerCase().includes(term) ||
        (e.work_email ?? '').toLowerCase().includes(term)
      );
    });
  }, [employees, search, department, status, noManagerOnly]);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <p className="text-sm text-gray-600 max-w-2xl">
          Everyone in the organisation. Open a person to change their job, reporting line, dates and details, or to record that they have left. Sign-in and
          role are managed under Access control.
        </p>
        {canWrite && (
          <Button variant="primary" onClick={() => onOpen('new')}>
            Add employee
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-4 text-sm">
        <button
          onClick={() => onNoManagerOnly(!noManagerOnly)}
          aria-pressed={noManagerOnly}
          className={`px-3 py-1.5 rounded-full border font-semibold ${
            noManagerOnly ? 'bg-amber-100 border-amber-300 text-amber-900' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          No manager recorded: {noManager}
        </button>
        <span className="px-3 py-1.5 rounded-full border border-gray-200 bg-white text-gray-600">No joining date: {noJoining}</span>
        <span className="px-3 py-1.5 rounded-full border border-gray-200 bg-white text-gray-600">{employees.length} people in total</span>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email or employee code…"
          aria-label="Search employees"
          className="flex-1 min-w-[16rem] max-w-md px-4 py-2 border border-gray-300 rounded-lg"
        />
        <div className="w-52">
          <Select aria-label="Filter by department" value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option value="">All departments</option>
            {lookups.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-40">
          <Select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value as '' | EmployeeStatus)}>
            <option value="">Any status</option>
            <option value="active">Active</option>
            <option value="on_leave">On leave</option>
            <option value="exited">Left</option>
          </Select>
        </div>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading people…</p>}
      {error && <Notice tone="error">{error}</Notice>}

      {!loading && !error && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-left">
              <tr>
                <th className="px-4 py-3 font-semibold">Person</th>
                <th className="px-4 py-3 font-semibold hidden md:table-cell">Job title</th>
                <th className="px-4 py-3 font-semibold hidden lg:table-cell">Department</th>
                <th className="px-4 py-3 font-semibold hidden xl:table-cell">Location</th>
                <th className="px-4 py-3 font-semibold hidden lg:table-cell">Reports to</th>
                <th className="px-4 py-3 font-semibold hidden md:table-cell">Joined</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const manager = e.manager_id ? byId[e.manager_id] : null;
                return (
                  <tr key={e.id} onClick={() => onOpen(e.id)} className="border-t border-gray-100 hover:bg-purple-50 cursor-pointer">
                    <td className="px-4 py-3">
                      <button className="font-semibold text-gray-900 text-left hover:underline" onClick={() => onOpen(e.id)}>
                        {fullName(e) || e.work_email}
                      </button>
                      <span className="ml-2 text-xs text-gray-400">{e.employee_code}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{e.designation_id ? designations[e.designation_id] ?? '—' : '—'}</td>
                    <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">{e.department_id ? departments[e.department_id] ?? '—' : '—'}</td>
                    <td className="px-4 py-3 text-gray-600 hidden xl:table-cell">{e.location_id ? locations[e.location_id] ?? '—' : '—'}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {manager ? <span className="text-gray-700">{fullName(manager)}</span> : <span className="text-amber-700">Not set</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{fmtDate(e.date_of_joining)}</td>
                    <td className="px-4 py-3">
                      {e.status === 'active' && <Badge tone="green">{STATUS_LABELS.active}</Badge>}
                      {e.status === 'on_leave' && <Badge tone="amber">{STATUS_LABELS.on_leave}</Badge>}
                      {e.status === 'exited' && <Badge tone="red">{STATUS_LABELS.exited}</Badge>}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                    No one matches these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {!loading && !error && <p className="text-xs text-gray-500 mt-3">Showing {rows.length} of {employees.length}.</p>}
    </div>
  );
}
