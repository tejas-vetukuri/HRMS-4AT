'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { adminApi, formatWhen, humanizeAction, type AuditEntry, type Page } from '@/lib/admin/api';
import { Notice, Pager, errorText } from './ui';

const PAGE_SIZE = 25;

export function ActivityTab() {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<AuditEntry> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    try {
      setData(await adminApi.listAudit({ search: debounced, page, pageSize: PAGE_SIZE }));
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, [debounced, page]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <p className="text-sm text-gray-600 max-w-2xl mb-4">
        A permanent record of sign-ins and every change to roles, access and employees: who did it, and when. Entries can never be edited or deleted.
      </p>
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by person, action or record…"
          aria-label="Search activity"
          className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg"
        />
        <button onClick={load} className="text-sm font-semibold text-purple-700 hover:underline">
          Refresh
        </button>
      </div>

      {error && <Notice tone="error">{error}</Notice>}
      {!data && !error && <p className="text-sm text-gray-500">Loading…</p>}
      {data && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-left">
              <tr>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">When</th>
                <th className="px-4 py-3 font-semibold">Who</th>
                <th className="px-4 py-3 font-semibold">What happened</th>
                <th className="px-4 py-3 font-semibold hidden md:table-cell">Record</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {data.results.map((e) => {
                const hasDetails = Object.keys(e.diff ?? {}).length > 0;
                return (
                  <Fragment key={e.id}>
                    <tr className="border-t border-gray-100 align-top">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatWhen(e.createdAt)}</td>
                      <td className="px-4 py-3 text-gray-900">{e.actorName ?? <span className="text-gray-400">Not signed in</span>}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{humanizeAction(e.action)}</td>
                      <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                        {e.entityType}
                        {e.entityId ? ` #${e.entityId}` : ''}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {hasDetails && (
                          <button
                            className="text-xs font-semibold text-purple-700 hover:underline"
                            onClick={() => setOpenId(openId === e.id ? null : e.id)}
                            aria-expanded={openId === e.id}
                          >
                            {openId === e.id ? 'Hide details' : 'Details'}
                          </button>
                        )}
                      </td>
                    </tr>
                    {openId === e.id && (
                      <tr className="bg-gray-50">
                        <td colSpan={5} className="px-4 py-3">
                          <pre className="text-xs text-gray-700 whitespace-pre-wrap break-words">{JSON.stringify(e.diff, null, 2)}</pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {data.results.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                    Nothing matches.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />}
    </div>
  );
}
