'use client';

import { useMemo, useState } from 'react';
import { fullName, type EmployeeRow } from '@/lib/admin/orgApi';
import { Badge, Button } from '../ui';
import { nameMap, type Lookups } from './useOrgData';

/** The reporting structure as an expandable tree, built from each person's manager. */
export function OrgChartTab({
  employees,
  lookups,
  onOpen,
  onShowUnmanaged,
}: {
  employees: EmployeeRow[];
  lookups: Lookups;
  onOpen: (id: string) => void;
  onShowUnmanaged: () => void;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const designations = useMemo(() => nameMap(lookups.designations), [lookups.designations]);
  const departments = useMemo(() => nameMap(lookups.departments), [lookups.departments]);

  const { children, roots, size } = useMemo(() => {
    const ids = new Set(employees.map((e) => e.id));
    const kids: Record<string, EmployeeRow[]> = {};
    const top: EmployeeRow[] = [];
    for (const e of employees) {
      if (e.manager_id && ids.has(e.manager_id)) (kids[e.manager_id] ||= []).push(e);
      else top.push(e);
    }
    const byName = (a: EmployeeRow, b: EmployeeRow) => fullName(a).localeCompare(fullName(b));
    Object.values(kids).forEach((list) => list.sort(byName));

    // Team size for every person (everyone beneath them), guarded against cycles.
    const counts: Record<string, number> = {};
    const count = (id: string, seen: Set<string>): number => {
      if (counts[id] !== undefined) return counts[id];
      if (seen.has(id)) return 0;
      seen.add(id);
      const total = (kids[id] ?? []).reduce((sum, k) => sum + 1 + count(k.id, seen), 0);
      counts[id] = total;
      return total;
    };
    employees.forEach((e) => count(e.id, new Set()));
    top.sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0) || byName(a, b));
    return { children: kids, roots: top, size: counts };
  }, [employees]);

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const expandAll = () => setOpen(new Set(employees.filter((e) => children[e.id]?.length).map((e) => e.id)));
  const withReports = roots.filter((r) => children[r.id]?.length);
  const alone = roots.filter((r) => !children[r.id]?.length);

  const Node = ({ e, depth, trail }: { e: EmployeeRow; depth: number; trail: string[] }) => {
    const kids = children[e.id] ?? [];
    const expanded = open.has(e.id);
    return (
      <li>
        <div className="flex items-center gap-2 py-1.5 pr-2 rounded-lg hover:bg-purple-50" style={{ paddingLeft: depth * 20 + 4 }}>
          {kids.length > 0 ? (
            <button onClick={() => toggle(e.id)} aria-expanded={expanded} aria-label={`${expanded ? 'Collapse' : 'Expand'} ${fullName(e)}`} className="w-6 h-6 rounded text-gray-600 hover:bg-gray-200 text-xs">
              {expanded ? '▼' : '▶'}
            </button>
          ) : (
            <span className="w-6" />
          )}
          <button onClick={() => onOpen(e.id)} className="text-left min-w-0">
            <span className="font-semibold text-gray-900">{fullName(e) || e.work_email}</span>
            <span className="ml-2 text-sm text-gray-500">
              {[e.designation_id ? designations[e.designation_id] : null, e.department_id ? departments[e.department_id] : null].filter(Boolean).join(' · ')}
            </span>
          </button>
          {kids.length > 0 && <Badge tone="purple">{size[e.id]} {size[e.id] === 1 ? 'person' : 'people'}</Badge>}
          {e.status !== 'active' && <Badge tone={e.status === 'exited' ? 'red' : 'amber'}>{e.status === 'exited' ? 'Left' : 'On leave'}</Badge>}
        </div>
        {expanded && kids.length > 0 && (
          <ul>
            {kids.map((k) => (trail.includes(k.id) ? null : <Node key={k.id} e={k} depth={depth + 1} trail={[...trail, e.id]} />))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div>
      <p className="text-sm text-gray-600 max-w-2xl mb-4">
        Who reports to whom. Expand a person to see their team, and click a name to open their record. To fix a reporting line, open the person and change who they report to.
      </p>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Button onClick={expandAll}>Expand all</Button>
        <Button onClick={() => setOpen(new Set())}>Collapse all</Button>
        <span className="text-sm text-gray-600 ml-2">
          {withReports.length} {withReports.length === 1 ? 'top-level team' : 'top-level teams'}
          {alone.length > 0 && (
            <>
              {' · '}
              <button onClick={onShowUnmanaged} className="text-purple-700 font-semibold hover:underline">
                {alone.length} with no manager and no team
              </button>
            </>
          )}
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-3">
        {withReports.length === 0 && <p className="text-sm text-gray-500 p-3">No reporting lines are recorded yet.</p>}
        <ul>
          {withReports.map((r) => (
            <Node key={r.id} e={r} depth={0} trail={[]} />
          ))}
        </ul>
      </div>
    </div>
  );
}
