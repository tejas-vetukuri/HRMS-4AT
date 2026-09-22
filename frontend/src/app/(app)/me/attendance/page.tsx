'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ClockIcon,
  HomeIcon,
  ChevronDownIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
} from '@/components/icons';
import {
  attendanceApi,
  AttendanceApiError,
  type AttendanceDayView,
  type AttendanceSummary,
  type AttendanceRequest,
  type AttendanceRequestStatus,
} from '@/lib/api/attendance';
import { useAuth } from '@/lib/auth/useAuth';

function AttendanceVisual({
  checkIn,
  checkOut,
  breakMinutes,
}: {
  checkIn?: string;
  checkOut?: string;
  breakMinutes?: number;
}) {
  if (!checkIn) {
    return <div className="h-2 w-full min-w-[140px] bg-slate-100 rounded-full" />;
  }

  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const fmtMin = (mins: number) => {
    const h = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, '0')} ${period}`;
  };

  const inProgress = !checkOut;
  const startMin = toMinutes(checkIn);
  const endMin = inProgress ? new Date().getHours() * 60 + new Date().getMinutes() : toMinutes(checkOut!);
  const totalDuration = Math.max(1, endMin - startMin);
  const brk = Math.min(breakMinutes ?? 0, Math.max(0, totalDuration - 20));

  // A single break is placed roughly mid-session, splitting the bar into two
  // "logged in" segments with a gap between them (matching the reference).
  const segments =
    brk > 0
      ? (() => {
          const preBreak = Math.floor((totalDuration - brk) / 2);
          const seg1End = startMin + preBreak;
          const seg2Start = seg1End + brk;
          return [
            { start: startMin, end: seg1End },
            { start: seg2Start, end: endMin },
          ];
        })()
      : [{ start: startMin, end: endMin }];

  const ticks = Array.from({ length: 11 }, (_, i) => ((i + 1) / 12) * 100); // every 2h across 24h

  return (
    <div className="relative w-full min-w-[140px] py-2">
      <div className="relative h-2 w-full bg-slate-100 rounded-full overflow-hidden">
        {ticks.map((pct) => (
          <span key={pct} className="absolute top-0 bottom-0 w-px bg-white/80" style={{ left: `${pct}%` }} />
        ))}
      </div>

      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1;
        return (
          <div
            key={i}
            className="group/seg absolute top-2 h-2"
            title={`Logged In ${fmtMin(seg.start)} - ${inProgress && isLast ? 'now' : fmtMin(seg.end)}`}
            style={{
              left: `${(seg.start / 1440) * 100}%`,
              width: `${Math.max(0.8, ((seg.end - seg.start) / 1440) * 100)}%`,
            }}
          >
            <div
              className={`h-full rounded-full ${
                inProgress && isLast ? 'bg-amber-400 animate-pulse' : 'bg-teal-400'
              }`}
            />
            <div className="hidden group-hover/seg:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20">
              <div className="bg-slate-700 text-white text-xs font-semibold rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
                Logged In {fmtMin(seg.start)} - {inProgress && isLast ? 'now' : fmtMin(seg.end)}
              </div>
              <div className="w-2 h-2 bg-slate-700 rotate-45 mx-auto -mt-1" />
            </div>
          </div>
        );
      })}

      {segments.length > 1
        ? (() => {
            const breakStart = segments[0].end;
            const breakEnd = segments[1].start;
            return (
              <div
                className="group/brk absolute top-2 h-2"
                title={`Break ${fmtMin(breakStart)} - ${fmtMin(breakEnd)} (${breakEnd - breakStart}m)`}
                style={{
                  left: `${(breakStart / 1440) * 100}%`,
                  width: `${Math.max(0.8, ((breakEnd - breakStart) / 1440) * 100)}%`,
                }}
              >
                <div className="h-full rounded-full bg-amber-300/0 group-hover/brk:bg-amber-300/80 transition-colors" />
                <div className="hidden group-hover/brk:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20">
                  <div className="bg-slate-700 text-white text-xs font-semibold rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
                    Break {fmtMin(breakStart)} - {fmtMin(breakEnd)} &middot; {breakEnd - breakStart}m
                  </div>
                  <div className="w-2 h-2 bg-slate-700 rotate-45 mx-auto -mt-1" />
                </div>
              </div>
            );
          })()
        : null}
    </div>
  );
}

/** Per-row "⋮" menu: regularise / request WFH / request leave for that date. */
function RowActionsMenu({
  date,
  open,
  onToggle,
  onClose,
}: {
  date: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <div ref={ref} className="inline-block text-left">
      <button
        onClick={onToggle}
        aria-label="Row actions"
        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="12" cy="19" r="1.6" />
        </svg>
      </button>
      {open ? (
        <div className="absolute right-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-md z-20 py-1 text-left">
          <button
            onClick={() => go(`/attendance/regularize?date=${date}`)}
            className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Regularise
          </button>
          <button
            onClick={() => go(`/attendance/wfh?date=${date}`)}
            className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Request Work From Home
          </button>
          <button
            onClick={() => go(`/leave/apply?date=${date}`)}
            className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Request Leave
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* ============================== data mapping ============================== */

type DayStatus = 'present' | 'weekoff' | 'holiday' | 'on_leave' | 'absent' | 'not_marked' | 'inprogress';

interface AttendanceRow {
  date: Date;
  status: DayStatus;
  checkIn?: string;
  checkOut?: string;
  effectiveMinutes?: number;
  arrival?: 'On Time' | 'Late';
  note?: string;
}

function fmtHM(minutes?: number) {
  if (minutes == null) return '-';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

// Local (not UTC) YYYY-MM-DD — Date#toISOString() converts to UTC first, which
// shifts the date by a day for anyone west of UTC. Build the string from the
// local getFullYear/getMonth/getDate instead.
function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmtClock(time24: string, use24h: boolean) {
  if (use24h) return time24;
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

// ISO timestamp (UTC) → local "HH:MM" 24h string, what AttendanceVisual expects.
function isoToHM(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function toAttendanceRow(v: AttendanceDayView): AttendanceRow {
  const date = new Date(`${v.attendance_date}T00:00:00`);

  if (v.status === 'weekend') return { date, status: 'weekoff' };
  if (v.status === 'holiday') return { date, status: 'holiday', note: v.holiday_name ?? 'Holiday' };
  if (v.status === 'on_leave') return { date, status: 'on_leave', note: v.leave_type_name ?? 'On Leave' };
  if (v.status === 'absent') return { date, status: 'absent' };
  if (v.status === 'not_marked') return { date, status: 'not_marked' };

  // present / work_from_home / half_day
  return {
    date,
    status: v.check_out ? 'present' : 'inprogress',
    checkIn: v.check_in ? isoToHM(v.check_in) : undefined,
    checkOut: v.check_out ? isoToHM(v.check_out) : undefined,
    effectiveMinutes: v.working_minutes ?? undefined,
    arrival: v.late_minutes && v.late_minutes > 0 ? 'Late' : 'On Time',
  };
}

type LogRangeMode = 'week' | 'month' | 'custom';

const logRangeOptions: { id: LogRangeMode; label: string }[] = [
  { id: 'week', label: 'Last 7 Days' },
  { id: 'month', label: 'Last 30 Days' },
  { id: 'custom', label: 'Custom' },
];

/* ============================== page ============================== */

export default function AttendancePage() {
  return (
    // `min-h-full` (not `min-h-screen`): this page already renders inside the
    // app layout's full-height `overflow-y-auto` container. `100vh` here stacks
    // on top of the header + padding and creates a phantom scroll region.
    <div className="min-h-full bg-slate-50 font-['Inter']">
      <div className="p-4 sm:p-8">
        <AttendanceTab />
      </div>
    </div>
  );
}

/* ============================== attendance tab ============================== */

function AttendanceTab() {
  const router = useRouter();
  const [statsPeriod, setStatsPeriod] = useState<'This Week' | 'Last Week' | 'This Month'>('Last Week');
  const [statsMenuOpen, setStatsMenuOpen] = useState(false);
  const [now, setNow] = useState(new Date());
  const [logSubTab, setLogSubTab] = useState<'log' | 'calendar' | 'requests'>('log');
  const [logRangeMode, setLogRangeMode] = useState<LogRangeMode>('month');
  const [logRangeMenuOpen, setLogRangeMenuOpen] = useState(false);
  const [rowActionsFor, setRowActionsFor] = useState<string | null>(null);
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 13);
    return toLocalISODate(d);
  });
  const [customTo, setCustomTo] = useState(() => toLocalISODate(new Date()));
  const [use24h, setUse24h] = useState(false);

  const [today, setToday] = useState<AttendanceDayView | null>(null);
  const [todayLoading, setTodayLoading] = useState(true);
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [historyViews, setHistoryViews] = useState<AttendanceDayView[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const refreshToday = () => {
    setTodayLoading(true);
    attendanceApi
      .getToday()
      .then(setToday)
      .catch(() => setToday(null))
      .finally(() => setTodayLoading(false));
  };

  useEffect(refreshToday, []);

  useEffect(() => {
    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError(null);

    const window =
      logRangeMode === 'week'
        ? (() => {
            const to = toLocalISODate(new Date());
            const from = toLocalISODate(new Date(Date.now() - 6 * 86400000));
            return { from, to };
          })()
        : logRangeMode === 'month'
          ? (() => {
              const to = toLocalISODate(new Date());
              const from = toLocalISODate(new Date(Date.now() - 29 * 86400000));
              return { from, to };
            })()
          : customFrom && customTo && customFrom <= customTo
            ? { from: customFrom, to: customTo }
            : null;

    if (!window) {
      setHistoryViews([]);
      setHistoryLoading(false);
      return;
    }

    attendanceApi
      .getHistory(window)
      .then((views) => {
        if (!cancelled) setHistoryViews(views);
      })
      .catch((e) => {
        if (!cancelled) setHistoryError(e instanceof Error ? e.message : 'Failed to load attendance');
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [logRangeMode, customFrom, customTo]);

  useEffect(() => {
    let cancelled = false;
    setSummaryLoading(true);

    const now = new Date();
    let from: Date;
    let to: Date;
    if (statsPeriod === 'This Week') {
      const dow = (now.getDay() + 6) % 7; // Monday = 0
      from = new Date(now);
      from.setDate(now.getDate() - dow);
      to = now;
    } else if (statsPeriod === 'Last Week') {
      const dow = (now.getDay() + 6) % 7;
      to = new Date(now);
      to.setDate(now.getDate() - dow - 1);
      from = new Date(to);
      from.setDate(to.getDate() - 6);
    } else {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = now;
    }

    attendanceApi
      .getSummary({ from: toLocalISODate(from), to: toLocalISODate(to) })
      .then((s) => {
        if (!cancelled) setSummary(s);
      })
      .catch(() => {
        if (!cancelled) setSummary(null);
      })
      .finally(() => {
        if (!cancelled) setSummaryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [statsPeriod]);

  const handleCheckIn = async () => {
    setActionPending(true);
    setActionError(null);
    try {
      await attendanceApi.checkIn();
      refreshToday();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Check-in failed');
    } finally {
      setActionPending(false);
    }
  };

  const handleCheckOut = async () => {
    setActionPending(true);
    setActionError(null);
    try {
      await attendanceApi.checkOut();
      refreshToday();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Check-out failed');
    } finally {
      setActionPending(false);
    }
  };

  const rows = historyViews.map(toAttendanceRow);

  const meHrs = summary ? fmtHM(summary.total_working_minutes) : '—';
  const meOnTime =
    summary && summary.present_days > 0
      ? Math.round(((summary.present_days - summary.late_days) / summary.present_days) * 100)
      : null;

  const fmtShortDate = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });

  const logRangeLabel =
    logRangeMode === 'week'
      ? 'Last 7 Days'
      : logRangeMode === 'month'
        ? 'Last 30 Days'
        : customFrom && customTo
          ? `${fmtShortDate(customFrom)} - ${fmtShortDate(customTo)}`
          : 'Custom Range';

  const todayLabel = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric' });
  const timeLabel = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const weekDayLetters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const todayIdx = (now.getDay() + 6) % 7; // Monday = 0

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Attendance Stats</h1>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Attendance Stats */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-5">
            <div className="relative">
              <button
                onClick={() => setStatsMenuOpen((o) => !o)}
                className="flex items-center gap-1.5 text-sm font-semibold text-slate-900"
              >
                {statsPeriod}
                <ChevronDownIcon className="w-4 h-4 text-slate-400" />
              </button>
              {statsMenuOpen ? (
                <div className="absolute left-0 mt-1 w-36 bg-white border border-slate-200 rounded-lg shadow-md z-10 py-1">
                  {(['This Week', 'Last Week', 'This Month'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => {
                        setStatsPeriod(p);
                        setStatsMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 ${
                        p === statsPeriod ? 'text-blue-600 font-medium' : 'text-slate-600'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <span className="text-slate-300" title="Weekly average across working days">
              ⓘ
            </span>
          </div>

          <div className="grid grid-cols-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2 px-1">
            <span />
            <span className="text-right">Avg Hrs / Day</span>
            <span className="text-right">On Time Arrival</span>
          </div>

          <div className="grid grid-cols-3 items-center py-3 border-t border-slate-100">
            <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[10px] font-bold">
                Me
              </span>
            </span>
            <span className="text-right text-lg font-bold text-slate-900">{summaryLoading ? '…' : meHrs}</span>
            <span className="text-right text-lg font-bold text-slate-900">
              {summaryLoading ? '…' : meOnTime !== null ? `${meOnTime}%` : '—'}
            </span>
          </div>

          <div className="grid grid-cols-3 items-center py-3 border-t border-slate-100">
            <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold">
                T
              </span>
              My Team
            </span>
            <span className="text-right text-lg font-bold text-slate-400">—</span>
            <span className="text-right text-lg font-bold text-slate-400">—</span>
          </div>
        </div>

        {/* Timings */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-base font-bold text-slate-900 mb-4">Timings</h3>
          <div className="flex items-center justify-between mb-5">
            {weekDayLetters.map((letter, i) => (
              <span
                key={i}
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                  i === todayIdx ? 'bg-blue-600 text-white' : 'text-slate-400'
                }`}
              >
                {letter}
              </span>
            ))}
          </div>

          {today?.check_in ? (
            <>
              <p className="text-xs text-slate-500 mb-2">
                Today ({isoToHM(today.check_in)}
                {today.check_out ? ` - ${isoToHM(today.check_out)}` : ' - now'})
              </p>
              <AttendanceVisual checkIn={isoToHM(today.check_in)} checkOut={today.check_out ? isoToHM(today.check_out) : undefined} />
              <div className="flex items-center justify-between text-xs text-slate-500 mt-3">
                <span>Duration: {fmtHM(today.working_minutes ?? undefined)}</span>
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-500">Not checked in yet today.</p>
          )}
        </div>

        {/* Actions */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-base font-bold text-slate-900 mb-4">Actions</h3>
          <div className="border border-slate-200 rounded-lg px-4 py-3 mb-4">
            <span className="text-2xl font-bold text-slate-900 tabular-nums">{timeLabel.replace(/(AM|PM)/, '')}</span>
            <span className="text-sm font-semibold text-slate-500 ml-1">{timeLabel.match(/AM|PM/)?.[0]}</span>
          </div>
          <p className="text-xs text-slate-500 mb-5">{todayLabel}</p>

          {!todayLoading && (
            <button
              onClick={today?.check_in && !today.check_out ? handleCheckOut : handleCheckIn}
              disabled={actionPending || Boolean(today?.check_in && today?.check_out)}
              className="w-full mb-4 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {today?.check_in && today?.check_out
                ? 'Checked out for today'
                : today?.check_in
                  ? actionPending
                    ? 'Checking out…'
                    : 'Check Out'
                  : actionPending
                    ? 'Checking in…'
                    : 'Check In'}
            </button>
          )}
          {actionError && <p className="text-xs text-red-600 mb-4">{actionError}</p>}

          <div className="space-y-3">
            <button
              onClick={() => router.push('/attendance/wfh')}
              className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              <HomeIcon className="w-4 h-4" />
              Work From Home
            </button>
            <button
              onClick={() => router.push('/help')}
              className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              <ClockIcon className="w-4 h-4" />
              Attendance Policy
            </button>
          </div>
        </div>
      </div>

      {/* Logs & Requests */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="text-base font-bold text-slate-900">Logs &amp; Requests</h2>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer select-none">
            <span
              onClick={() => setUse24h((v) => !v)}
              className={`w-9 h-5 rounded-full flex items-center px-0.5 transition-colors ${
                use24h ? 'bg-blue-600 justify-end' : 'bg-slate-200 justify-start'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-white shadow" />
            </span>
            24 hour format
          </label>
        </div>

        <div className="flex gap-6 px-5 mt-4 border-b border-slate-200">
          {(
            [
              ['log', 'Attendance Log'],
              ['calendar', 'Calendar'],
              ['requests', 'Attendance Requests'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setLogSubTab(id)}
              className={`pb-3 -mb-px text-sm font-medium border-b-2 transition-colors ${
                logSubTab === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {logSubTab === 'log' ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <h3 className="text-sm font-semibold text-slate-900">{logRangeLabel}</h3>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <button
                    onClick={() => setLogRangeMenuOpen((o) => !o)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50"
                  >
                    {logRangeOptions.find((o) => o.id === logRangeMode)?.label}
                    <ChevronDownIcon className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  {logRangeMenuOpen ? (
                    <div className="absolute right-0 mt-1 w-36 bg-white border border-slate-200 rounded-lg shadow-md z-10 py-1">
                      {logRangeOptions.map((o) => (
                        <button
                          key={o.id}
                          onClick={() => {
                            setLogRangeMode(o.id);
                            setLogRangeMenuOpen(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 ${
                            o.id === logRangeMode ? 'text-blue-600 font-medium' : 'text-slate-600'
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                {logRangeMode === 'custom' ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={customFrom}
                      max={customTo}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      className="text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/10"
                    />
                    <span className="text-xs text-slate-400">to</span>
                    <input
                      type="date"
                      value={customTo}
                      min={customFrom}
                      max={toLocalISODate(new Date())}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className="text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/10"
                    />
                  </div>
                ) : null}
              </div>
            </div>

            {historyLoading && <p className="px-5 pb-4 text-sm text-slate-500">Loading...</p>}
            {historyError && !historyLoading && <p className="px-5 pb-4 text-sm text-red-600">{historyError}</p>}

            {!historyLoading && !historyError && (
              <div className="overflow-x-auto overflow-y-visible">
                <table className="w-full">
                  <thead className="bg-slate-50 border-y border-slate-200">
                    <tr>
                      {['Date', 'Attendance Visual', 'Effective Hours', 'Arrival', 'Log', ''].map((h) => (
                        <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((row) => {
                      const badge: Record<string, { label: string; cls: string; text: string }> = {
                        weekoff: { label: 'W-OFF', cls: 'bg-slate-100 text-slate-500', text: 'Full day Weekly-off' },
                        holiday: { label: 'HOL', cls: 'bg-amber-100 text-amber-700', text: row.note ?? 'Holiday' },
                        on_leave: { label: 'LEAVE', cls: 'bg-violet-100 text-violet-700', text: row.note ?? 'On Leave' },
                        absent: { label: 'ABSENT', cls: 'bg-red-100 text-red-700', text: 'Absent' },
                        not_marked: { label: 'PENDING', cls: 'bg-slate-100 text-slate-400', text: 'Not marked yet' },
                      };
                      const placeholder = badge[row.status];

                      return (
                        <tr key={row.date.toISOString()} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-4 text-sm font-medium text-slate-900 whitespace-nowrap">
                            {row.date.toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short' })}
                            {placeholder ? (
                              <span className={`ml-2 text-[10px] font-semibold rounded px-1.5 py-0.5 ${placeholder.cls}`}>
                                {placeholder.label}
                              </span>
                            ) : null}
                          </td>
                          {placeholder ? (
                            <td className="px-5 py-4 text-sm text-slate-400" colSpan={4}>
                              {placeholder.text}
                            </td>
                          ) : (
                            <>
                              <td className="px-5 py-4">
                                <AttendanceVisual checkIn={row.checkIn} checkOut={row.checkOut} />
                              </td>
                              <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                                {fmtHM(row.effectiveMinutes)}
                                {row.status === 'inprogress' ? ' +' : ''}
                              </td>
                              <td className="px-5 py-4">
                                <span
                                  className={`inline-flex items-center gap-1 text-sm font-medium ${
                                    row.arrival === 'Late' ? 'text-amber-600' : 'text-slate-700'
                                  }`}
                                >
                                  {row.arrival === 'Late' ? '⚠' : '✓'} {row.arrival}
                                </span>
                              </td>
                              <td className="px-5 py-4">
                                {row.status === 'inprogress' ? (
                                  <span className="text-amber-500" title="In progress">
                                    <AlertTriangleIcon className="w-4 h-4" />
                                  </span>
                                ) : (
                                  <span className="text-emerald-500" title="Complete">
                                    <CheckCircleIcon className="w-4 h-4" />
                                  </span>
                                )}
                              </td>
                            </>
                          )}
                          <td className="px-5 py-4 text-right relative">
                            <RowActionsMenu
                              date={toLocalISODate(row.date)}
                              open={rowActionsFor === toLocalISODate(row.date)}
                              onToggle={() =>
                                setRowActionsFor((cur) =>
                                  cur === toLocalISODate(row.date) ? null : toLocalISODate(row.date),
                                )
                              }
                              onClose={() => setRowActionsFor(null)}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : null}

        {logSubTab === 'calendar' ? <MiniCalendar rows={rows} /> : null}
        {logSubTab === 'requests' ? <AttendanceRequestsList rangeLabel={logRangeLabel} /> : null}
      </div>

      {/* only reason use24h/fmtClock helper exists is to keep parity with the toggle; small usage to avoid unused warnings */}
      <span className="sr-only">{fmtClock('09:00', use24h)}</span>
    </div>
  );
}

function MiniCalendar({ rows }: { rows: AttendanceRow[] }) {
  const byDate = new Map(rows.map((r) => [r.date.toDateString(), r]));
  const first = rows[rows.length - 1]?.date ?? new Date();
  const year = first.getFullYear();
  const month = first.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // Monday-first

  const cells: (Date | null)[] = Array(firstWeekday).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const colorFor = (status?: DayStatus) => {
    switch (status) {
      case 'present':
        return 'bg-emerald-100 text-emerald-700';
      case 'inprogress':
        return 'bg-blue-100 text-blue-700';
      case 'on_leave':
        return 'bg-violet-100 text-violet-700';
      case 'holiday':
        return 'bg-amber-100 text-amber-700';
      case 'absent':
        return 'bg-red-100 text-red-700';
      case 'weekoff':
        return 'bg-slate-100 text-slate-400';
      default:
        return 'text-slate-300';
    }
  };

  return (
    <div className="p-5">
      <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-semibold text-slate-400 uppercase mb-2">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {cells.map((date, i) =>
          date ? (
            <div
              key={i}
              className={`aspect-square rounded-lg flex items-center justify-center text-sm font-medium ${colorFor(
                byDate.get(date.toDateString())?.status,
              )}`}
            >
              {date.getDate()}
            </div>
          ) : (
            <div key={i} />
          ),
        )}
      </div>
    </div>
  );
}

function requestStatusPillClass(status: AttendanceRequestStatus): string {
  switch (status) {
    case 'approved':
      return 'bg-emerald-100 text-emerald-700';
    case 'submitted':
      return 'bg-amber-100 text-amber-700';
    case 'rejected':
      return 'bg-red-100 text-red-700';
    case 'cancelled':
      return 'bg-slate-100 text-slate-600';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

const requestStatusLabel: Record<AttendanceRequestStatus, string> = {
  submitted: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

function fmtRequestDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtRequestRange(start: string, end: string): string {
  return start === end ? fmtRequestDate(start) : `${fmtRequestDate(start)} – ${fmtRequestDate(end)}`;
}

function AttendanceRequestsList({ rangeLabel }: { rangeLabel: string }) {
  const { user } = useAuth();
  const canApprove = user?.permissions.includes('attendance.approve') ?? false;

  const [ownRequests, setOwnRequests] = useState<AttendanceRequest[]>([]);
  const [approvals, setApprovals] = useState<AttendanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const refresh = useCallback(async () => {
    setOwnRequests(await attendanceApi.getRequests());
    if (canApprove) {
      try {
        setApprovals(await attendanceApi.getPendingApprovals());
      } catch {
        setApprovals([]);
      }
    } else {
      setApprovals([]);
    }
  }, [canApprove]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    refresh()
      .catch((e) => {
        if (active) setLoadError(e instanceof Error ? e.message : 'Failed to load attendance requests');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refresh]);

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    setActionError(null);
    setActionMessage(null);
    try {
      await attendanceApi.cancelRequest(id);
      setActionMessage('Request cancelled.');
      await refresh();
    } catch (e) {
      setActionError(e instanceof AttendanceApiError ? e.message : 'Could not cancel this request');
    } finally {
      setCancellingId(null);
    }
  };

  const handleDecide = async (id: string, approve: boolean) => {
    setDecidingId(id);
    setActionError(null);
    setActionMessage(null);
    try {
      await attendanceApi.decideRequest(id, approve, approve ? undefined : rejectReason.trim());
      setActionMessage(approve ? 'Request approved.' : 'Request rejected.');
      setRejectingId(null);
      setRejectReason('');
      await refresh();
    } catch (e) {
      setActionError(e instanceof AttendanceApiError ? e.message : 'Could not update this request');
    } finally {
      setDecidingId(null);
    }
  };

  const wfhRequests = ownRequests.filter((r) => r.request_type === 'wfh');
  const regularisationRequests = ownRequests.filter((r) => r.request_type === 'regularisation');

  if (loading) {
    return <div className="p-5 text-sm text-slate-500">Loading requests…</div>;
  }
  if (loadError) {
    return <div className="p-5 text-sm text-red-600">{loadError}</div>;
  }

  return (
    <div className="p-5 space-y-5">
      {(actionMessage || actionError) && (
        <div
          className={`rounded-lg text-sm px-4 py-3 ${
            actionError ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
          }`}
        >
          {actionError || actionMessage}
        </div>
      )}

      {/* Approvals (managers/HR only) */}
      {canApprove ? (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4">
            <h3 className="text-base font-bold text-slate-900">Approvals</h3>
          </div>
          {approvals.length === 0 ? (
            <p className="mx-5 mb-5 text-sm text-slate-400">No requests awaiting your approval.</p>
          ) : (
            <div className="mx-5 mb-5 space-y-3">
              {approvals.map((a) => (
                <div key={a.id} className="border border-slate-200 rounded-lg px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {a.employee_name || 'Employee'} —{' '}
                        {a.request_type === 'wfh' ? 'Work From Home' : 'Regularisation'}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {fmtRequestRange(a.start_date, a.end_date)}
                        {a.reason ? ` · ${a.reason}` : ''}
                      </p>
                    </div>
                    {rejectingId === a.id ? null : (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleDecide(a.id, true)}
                          disabled={decidingId === a.id}
                          className="text-xs font-semibold px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => {
                            setRejectingId(a.id);
                            setRejectReason('');
                          }}
                          disabled={decidingId === a.id}
                          className="text-xs font-semibold px-3 py-1.5 rounded-md border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                  {rejectingId === a.id ? (
                    <div className="flex items-center gap-2 mt-3">
                      <input
                        type="text"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Reason for rejection (required)"
                        className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500/10"
                      />
                      <button
                        onClick={() => handleDecide(a.id, false)}
                        disabled={decidingId === a.id || rejectReason.trim().length === 0}
                        className="text-xs font-semibold px-3 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        Confirm reject
                      </button>
                      <button
                        onClick={() => {
                          setRejectingId(null);
                          setRejectReason('');
                        }}
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
      ) : null}

      {/* Work From Home Requests */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4">
          <h3 className="text-base font-bold text-slate-900">Work From Home Requests</h3>
          <span className="text-xs text-slate-400">{rangeLabel}</span>
        </div>
        {wfhRequests.length === 0 ? (
          <div className="mx-5 mb-5 rounded-lg bg-blue-50 text-blue-700 text-sm px-4 py-3">
            No Work From Home Requests Available.
          </div>
        ) : (
          <div className="mx-5 mb-5 space-y-2">
            {wfhRequests.map((r) => (
              <div key={r.id} className="flex items-center justify-between border border-slate-200 rounded-lg px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{fmtRequestRange(r.start_date, r.end_date)}</p>
                  {r.reason ? <p className="text-xs text-slate-500 mt-0.5">{r.reason}</p> : null}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[11px] font-semibold rounded-full px-2.5 py-1 ${requestStatusPillClass(r.status)}`}>
                    {requestStatusLabel[r.status]}
                  </span>
                  {r.status === 'submitted' ? (
                    <button
                      onClick={() => handleCancel(r.id)}
                      disabled={cancellingId === r.id}
                      className="text-xs font-medium text-red-500 hover:text-red-600 disabled:opacity-50"
                    >
                      {cancellingId === r.id ? 'Cancelling…' : 'Cancel'}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Regularisation Requests */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4">
          <h3 className="text-base font-bold text-slate-900">Regularisation Requests</h3>
          <span className="text-xs text-slate-400">{rangeLabel}</span>
        </div>
        {regularisationRequests.length === 0 ? (
          <div className="mx-5 mb-5 rounded-lg bg-blue-50 text-blue-700 text-sm px-4 py-3">
            No Regularisation Requests Available.
          </div>
        ) : (
          <div className="mx-5 mb-5 space-y-2">
            {regularisationRequests.map((r) => (
              <div key={r.id} className="flex items-center justify-between border border-slate-200 rounded-lg px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{fmtRequestDate(r.start_date)}</p>
                  {r.reason ? <p className="text-xs text-slate-500 mt-0.5">{r.reason}</p> : null}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[11px] font-semibold rounded-full px-2.5 py-1 ${requestStatusPillClass(r.status)}`}>
                    {requestStatusLabel[r.status]}
                  </span>
                  {r.status === 'submitted' ? (
                    <button
                      onClick={() => handleCancel(r.id)}
                      disabled={cancellingId === r.id}
                      className="text-xs font-medium text-red-500 hover:text-red-600 disabled:opacity-50"
                    >
                      {cancellingId === r.id ? 'Cancelling…' : 'Cancel'}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
