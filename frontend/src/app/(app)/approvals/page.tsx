'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/useAuth';
import { requestsApi, type ApprovalRequest } from '@/lib/api/requests';
import { usePenalisations, type PenalisationRecord, type PenalisationStatus } from '@/lib/attendance/penalisation';

/* ============================== generic inbox (backend/approvals) ============================== */

type Tab = 'to-approve' | 'mine' | 'penalisation';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
}

function payloadSummary(payload: Record<string, unknown>): string {
  const entries = Object.entries(payload ?? {});
  if (entries.length === 0) return '—';
  return entries
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join(' · ');
}

const statusStyles: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
  withdrawn: 'bg-slate-100 text-slate-600',
};

/* ============================== penalisations (no engine equivalent - see docs/LEAVE-ATTENDANCE-INTEGRATION.md) ==============================
 *
 * A penalisation applies automatically once the regularisation grace period
 * lapses - there's no "raise a request, route to a manager" step, so it
 * doesn't fit the approvals engine's pending/approved/rejected/withdrawn
 * request lifecycle. It stays a bespoke section on this page rather than
 * being ported onto `requestsApi`. Sample-data only for now (no backend yet)
 * - see lib/attendance/penalisation.ts. */

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const PENALISATION_FILTERS: { id: PenalisationStatus; label: string }[] = [
  { id: 'applied', label: 'Applied' },
  { id: 'overturn_requested', label: 'Overturn Requested' },
  { id: 'overturned', label: 'Overturned' },
];

interface PenalisationSectionProps {
  records: PenalisationRecord[];
  decidingId: string | null;
  rejectingId: string | null;
  rejectReason: string;
  onSetRejecting: (id: string | null) => void;
  onSetRejectReason: (v: string) => void;
  approvingId: string | null;
  approveRemarks: string;
  onSetApproving: (id: string | null) => void;
  onSetApproveRemarks: (v: string) => void;
  onDirectOverturn: (id: string) => void;
  onApproveOverturnRequest: (id: string, remarks?: string) => void;
  onRejectOverturnRequest: (id: string) => void;
}

/** Approvals > Penalisation. A penalisation applies automatically once the
 * regularisation grace period lapses, so there's no "pending" state to
 * review - the three filters here are just where a penalisation currently
 * stands: still Applied, an employee has asked HR to reconsider it (Overturn
 * Requested, via Leave Management), or it's been Overturned. HR can overturn
 * an Applied one directly, or approve/reject a pending request. */
function PenalisationSection({
  records,
  decidingId,
  rejectingId,
  rejectReason,
  onSetRejecting,
  onSetRejectReason,
  approvingId,
  approveRemarks,
  onSetApproving,
  onSetApproveRemarks,
  onDirectOverturn,
  onApproveOverturnRequest,
  onRejectOverturnRequest,
}: PenalisationSectionProps) {
  const [filter, setFilter] = useState<PenalisationStatus>('applied');
  const filtered = records.filter((r) => r.status === filter);

  const emptyLabel: Record<PenalisationStatus, string> = {
    applied: 'No applied penalisations.',
    overturn_requested: 'No overturn requests awaiting your review.',
    overturned: 'No overturned penalisations yet.',
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
        <h2 className="text-base font-bold text-slate-900">Penalisations</h2>
        <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden">
          {PENALISATION_FILTERS.map(({ id, label }, i) => {
            const count = records.filter((r) => r.status === id).length;
            return (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${i > 0 ? 'border-l border-slate-200' : ''} ${
                  filter === id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {label}
                {count ? ` (${count})` : ''}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-5">
        {filtered.length === 0 ? (
          <p className="text-sm text-slate-400">{emptyLabel[filter]}</p>
        ) : (
          <div className="space-y-3">
            {filtered.map((r) => (
              <div key={r.id} className="border border-slate-200 rounded-lg px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {r.employeeName} — Absent {fmtDate(r.absentDate)}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {r.reason} · {r.daysOverdue} day(s) overdue
                    </p>
                    {filter === 'overturn_requested' ? (
                      <p className="text-xs text-slate-600 mt-1">
                        Requested {fmtDate(r.overturnRequestedOn!)} · {r.overturnRequestReason}
                      </p>
                    ) : null}
                    {filter === 'overturned' ? (
                      <p className="text-xs text-slate-400 mt-1">
                        Overturned by {r.overturnedBy}
                        {r.overturnedReason ? ` — ${r.overturnedReason}` : ''}
                      </p>
                    ) : null}
                  </div>

                  {filter === 'applied' && rejectingId !== r.id ? (
                    <button
                      onClick={() => {
                        onSetRejecting(r.id);
                        onSetRejectReason('');
                      }}
                      disabled={decidingId === r.id}
                      className="text-xs font-semibold px-3 py-1.5 rounded-md border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 shrink-0"
                    >
                      Overturn
                    </button>
                  ) : null}

                  {filter === 'overturn_requested' && rejectingId !== r.id && approvingId !== r.id ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          onSetApproving(r.id);
                          onSetApproveRemarks('');
                        }}
                        disabled={decidingId === r.id}
                        className="text-xs font-semibold px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          onSetRejecting(r.id);
                          onSetRejectReason('');
                        }}
                        disabled={decidingId === r.id}
                        className="text-xs font-semibold px-3 py-1.5 rounded-md border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  ) : null}
                </div>

                {approvingId === r.id ? (
                  <div className="flex items-center gap-2 mt-3">
                    <input
                      type="text"
                      value={approveRemarks}
                      onChange={(e) => onSetApproveRemarks(e.target.value)}
                      placeholder="Remarks (optional)"
                      className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/10"
                    />
                    <button
                      onClick={() => onApproveOverturnRequest(r.id, approveRemarks.trim() || undefined)}
                      disabled={decidingId === r.id}
                      className="text-xs font-semibold px-3 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Confirm approve
                    </button>
                    <button
                      onClick={() => onSetApproving(null)}
                      className="text-xs font-medium px-3 py-2 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                ) : null}

                {rejectingId === r.id ? (
                  <div className="flex items-center gap-2 mt-3">
                    <input
                      type="text"
                      value={rejectReason}
                      onChange={(e) => onSetRejectReason(e.target.value)}
                      placeholder={
                        filter === 'applied' ? 'Reason for overturning (required)' : 'Reason for rejecting this request (required)'
                      }
                      className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500/10"
                    />
                    <button
                      onClick={() => (filter === 'applied' ? onDirectOverturn(r.id) : onRejectOverturnRequest(r.id))}
                      disabled={decidingId === r.id || rejectReason.trim().length === 0}
                      className="text-xs font-semibold px-3 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {filter === 'applied' ? 'Confirm overturn' : 'Confirm reject'}
                    </button>
                    <button
                      onClick={() => onSetRejecting(null)}
                      className="text-xs font-medium px-3 py-2 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================== page ============================== */

export default function ApprovalsPage() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('to-approve');
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [actingId, setActingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Sample-data only — penalisations aren't automated on the backend yet, so
  // decisions here just update this shared (localStorage-backed) state rather
  // than calling an API. See lib/attendance/penalisation.ts.
  const [penalisations, updatePenalisations] = usePenalisations();
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  // Penalisation actions are synchronous (local state only, no API call in
  // flight), so this never actually transitions away from null - kept only
  // to satisfy PenalisationSection's shared prop contract.
  const [decidingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approveRemarks, setApproveRemarks] = useState('');

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t === 'to-approve' || t === 'mine' || t === 'penalisation') setTab(t);
  }, [searchParams]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      setRequests(await requestsApi.list());
    } catch {
      // Never an error screen: fall back to empty states with a retry affordance.
      setRequests([]);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const act = useCallback(
    async (id: string, fn: (id: string, note?: string) => Promise<unknown>) => {
      setActingId(id);
      setActionError(null);
      try {
        await fn(id, notes[id] ?? '');
        setNotes((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        await refresh();
      } catch (e) {
        setActionError(e instanceof Error ? e.message : 'That action failed. Try again.');
      } finally {
        setActingId(null);
      }
    },
    [notes, refresh],
  );

  const me = user?.id ?? null;
  const toApprove = requests.filter((r) => r.status === 'pending' && me != null && r.approver === me);
  const mine = requests.filter((r) => me != null && r.requester === me);

  const clearDecisionState = () => {
    setRejectingId(null);
    setRejectReason('');
    setApprovingId(null);
    setApproveRemarks('');
  };

  // HR can overturn an Applied penalisation directly, or approve/reject a
  // request the employee submitted themselves from Leave Management.
  const directOverturnPenalisation = (id: string) => {
    updatePenalisations((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, status: 'overturned', overturnedBy: 'You', overturnedReason: rejectReason.trim() } : p,
      ),
    );
    setActionMessage('Penalisation overturned.');
    clearDecisionState();
  };

  const approveOverturnRequest = (id: string, remarks?: string) => {
    updatePenalisations((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, status: 'overturned', overturnedBy: 'You', overturnedReason: remarks || p.overturnRequestReason }
          : p,
      ),
    );
    setActionMessage('Overturn request approved — penalisation overturned.');
    clearDecisionState();
  };

  const rejectOverturnRequest = (id: string) => {
    updatePenalisations((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, status: 'applied', overturnRequestReason: undefined, overturnRequestedOn: undefined } : p,
      ),
    );
    setActionMessage('Overturn request rejected — penalisation remains applied.');
    clearDecisionState();
  };

  return (
    <div className="min-h-screen bg-gray-50 font-['Inter']">
      {/* Section tabs come from the uniform sub-nav in the app layout, driven by
          the ?tab= query this page reads above. */}
      <div className="p-4 sm:p-8 max-w-4xl mx-auto">
        {actionError ? (
          <p role="alert" className="mb-4 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
            {actionError}
          </p>
        ) : null}
        {actionMessage ? (
          <p className="mb-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
            {actionMessage}
          </p>
        ) : null}

        {tab === 'penalisation' ? (
          <PenalisationSection
            records={penalisations}
            decidingId={decidingId}
            rejectingId={rejectingId}
            rejectReason={rejectReason}
            onSetRejecting={setRejectingId}
            onSetRejectReason={setRejectReason}
            approvingId={approvingId}
            approveRemarks={approveRemarks}
            onSetApproving={setApprovingId}
            onSetApproveRemarks={setApproveRemarks}
            onDirectOverturn={directOverturnPenalisation}
            onApproveOverturnRequest={approveOverturnRequest}
            onRejectOverturnRequest={rejectOverturnRequest}
          />
        ) : loading ? (
          <p className="text-sm text-gray-500">Loading requests...</p>
        ) : tab === 'to-approve' ? (
          toApprove.length === 0 ? (
            <EmptyState
              title="Nothing waiting for your approval"
              body={loadFailed ? 'We could not load requests right now.' : 'Requests routed to you will show up here.'}
              retry={loadFailed ? refresh : undefined}
            />
          ) : (
            <ul className="space-y-3">
              {toApprove.map((r) => (
                <li key={r.id} className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 capitalize">{r.requestType} request</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Raised {formatDate(r.createdAt)} · {payloadSummary(r.payload)}
                      </p>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusStyles[r.status]}`}>
                      {r.status}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={notes[r.id] ?? ''}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    placeholder="Add a note (optional)"
                    aria-label={`Decision note for ${r.requestType} request`}
                    className="mt-3 w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-slate-300"
                  />
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={actingId === r.id}
                      onClick={() => act(r.id, (id, note) => requestsApi.approve(id, note))}
                      className="px-4 py-2 text-sm font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                    >
                      {actingId === r.id ? 'Working...' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      disabled={actingId === r.id}
                      onClick={() => act(r.id, (id, note) => requestsApi.reject(id, note))}
                      className="px-4 py-2 text-sm font-semibold rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    >
                      {actingId === r.id ? 'Working...' : 'Reject'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : (
          <div className="space-y-4">
            <RaiseRequest onCreated={refresh} />
            {mine.length === 0 ? (
              <EmptyState
                title="You have not raised any requests"
                body={
                  loadFailed
                    ? 'We could not load requests right now.'
                    : 'Requests you raise (leave, expenses, assets…) will show up here.'
                }
                retry={loadFailed ? refresh : undefined}
              />
            ) : (
              <ul className="space-y-3">
                {mine.map((r) => (
                  <li key={r.id} className="bg-white border border-slate-200 rounded-xl p-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 capitalize">{r.requestType} request</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Raised {formatDate(r.createdAt)} · {payloadSummary(r.payload)}
                        </p>
                        {r.decisionNote ? <p className="text-xs text-slate-600 mt-1">Note: {r.decisionNote}</p> : null}
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusStyles[r.status]}`}>
                        {r.status}
                      </span>
                    </div>
                    {r.status === 'pending' ? (
                      <div className="mt-3">
                        <button
                          type="button"
                          disabled={actingId === r.id}
                          onClick={() => act(r.id, (id) => requestsApi.withdraw(id))}
                          className="px-4 py-2 text-sm font-semibold rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                        >
                          {actingId === r.id ? 'Working...' : 'Withdraw'}
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const REQUEST_TYPES = ['leave', 'wfh', 'expense', 'asset', 'other'] as const;

function RaiseRequest({ onCreated }: { onCreated: () => Promise<void> | void }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<string>('leave');
  const [reason, setReason] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {};
      if (reason.trim()) payload.reason = reason.trim();
      if (from) payload.from = from;
      if (to) payload.to = to;
      await requestsApi.create(type, payload);
      setReason('');
      setFrom('');
      setTo('');
      setOpen(false);
      await onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not raise the request. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-4 py-2 text-sm font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
      >
        Raise a request
      </button>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      <p className="text-sm font-semibold text-slate-900">Raise a request</p>
      {error ? (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <label className="text-xs text-slate-500">
          Type
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="mt-1 block px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl capitalize focus:outline-none focus:bg-white focus:border-slate-300"
          >
            {REQUEST_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-500">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 block px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-slate-300"
          />
        </label>
        <label className="text-xs text-slate-500">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 block px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-slate-300"
          />
        </label>
      </div>
      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (optional)"
        aria-label="Reason"
        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-slate-300"
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={submitting}
          onClick={submit}
          className="px-4 py-2 text-sm font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Submitting...' : 'Submit'}
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => setOpen(false)}
          className="px-4 py-2 text-sm font-semibold rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function EmptyState({
  title,
  body,
  retry,
}: {
  title: string;
  body: string;
  retry?: () => void;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-6 py-12 text-center">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="text-sm text-slate-500 mt-1">{body}</p>
      {retry ? (
        <button
          type="button"
          onClick={retry}
          className="mt-4 px-4 py-2 text-sm font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
