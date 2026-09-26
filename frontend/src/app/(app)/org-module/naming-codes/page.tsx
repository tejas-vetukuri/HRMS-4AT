'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { orgApi, type OrgEmployee } from '@/lib/api/org';
import { PageHeader } from '@/components/org-module/ui';

/** Detect the employee-code convention, e.g. EMP0001 -> prefix "EMP", 4 digits. */
function detectCodePattern(codes: string[]): {
  description: string;
  examples: string[];
} {
  const clean = codes.filter(Boolean);
  if (clean.length === 0) return { description: 'No employee codes found yet.', examples: [] };
  const m = clean[0].match(/^([A-Za-z-]*)(\d+)([A-Za-z-]*)$/);
  if (!m) {
    return {
      description: `Observed codes start with “${clean[0]}” — no shared letter/digit pattern detected.`,
      examples: clean.slice(0, 5),
    };
  }
  const [, prefix, digits, suffix] = m;
  const width = digits.length;
  const consistent = clean.every((c) => {
    const mm = c.match(/^([A-Za-z-]*)(\d+)([A-Za-z-]*)$/);
    return mm !== null && mm[1] === prefix && mm[2].length === width && mm[3] === suffix;
  });
  const shape = `${prefix || '∅'} + ${width} digits${suffix ? ` + “${suffix}”` : ''}`;
  return {
    description: consistent
      ? `Employee codes follow ${shape} (e.g. ${clean[0]}).`
      : `Most codes look like ${shape}, with some exceptions — see examples.`,
    examples: clean.slice(0, 5),
  };
}

export default function NamingCodesPage() {
  const [employees, setEmployees] = useState<OrgEmployee[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      setEmployees(await orgApi.listEmployees());
    } catch {
      setEmployees(null);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const pattern = useMemo(
    () => detectCodePattern((employees ?? []).map((e) => e.employee_code)),
    [employees],
  );

  return (
    <div>
      <PageHeader
        title="Naming / Codes"
        subtitle="Code conventions observed from live employee data. Read-only — these are measured, not configured."
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
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden max-w-2xl">
          <div className="px-5 py-3 border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-900">Prefix & sequence conventions</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Derived from {employees?.length ?? 0} live employee codes.
            </p>
          </div>
          <div className="px-5 py-4">
            <p className="text-sm text-slate-700">{pattern.description}</p>
            {pattern.examples.length > 0 ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {pattern.examples.map((c) => (
                  <li
                    key={c}
                    className="text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700"
                  >
                    {c}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
