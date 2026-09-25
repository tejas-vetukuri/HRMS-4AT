'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/useAuth';
import {
  onboardingApi,
  OnboardingApiError,
  OnboardingRecordListItem,
  OnboardingTemplate,
  OnboardingStage,
  TaskCategory,
  TaskOwner,
  CreateNewHireInput,
  TemplateInput,
  EmploymentType,
  OfferLetterTemplate,
  OfferLetterTemplateInput,
  STAGE_LABEL,
  STAGE_COLOR,
  OWNER_LABEL,
  EMPLOYMENT_TYPE_LABEL,
  OFFER_STATUS_LABEL,
  OFFER_STATUS_COLOR,
  offerNextAction,
  formatDate,
  AccessArea,
  AccessGrant,
} from '@/lib/api/onboarding';
import { PlusIcon, FileTextIcon } from '@/components/icons';

interface NamedEntity {
  id: number;
  name: string;
}

interface EmployeeLookupItem {
  id: number;
  name: string;
  workEmail: string;
  employeeCode: string;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  const body = await res.json();
  if (!res.ok || !body?.success) {
    throw new Error(body?.error?.message || `Request to ${url} failed`);
  }
  return body.data as T;
}

const STAGE_FILTERS: { value: OnboardingStage | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'preboarding', label: 'Preboarding' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'completed', label: 'Completed' },
];

export default function OnboardingPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const isHrAdmin = user?.role === 'superadmin';
  // Managers and HR Admin manage new hires here; a plain employee uses their
  // own /me/onboarding checklist instead — this page's own nav entry is
  // already role-gated (layout.tsx), this is the matching direct-URL guard.
  const hasAccess = !!user && (user.role === 'admin' || user.role === 'superadmin');
  const permissionLoading = authLoading;

  useEffect(() => {
    if (!authLoading && !hasAccess) {
      router.push('/');
    }
  }, [authLoading, hasAccess, router]);

  const [tab, setTab] = useState<'records' | 'templates' | 'offerLetterTemplates' | 'access'>('records');
  const [records, setRecords] = useState<OnboardingRecordListItem[]>([]);
  const [stageFilter, setStageFilter] = useState<OnboardingStage | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const loadRecords = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await onboardingApi.getRecords();
      setRecords(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load onboarding records');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (permissionLoading || !hasAccess) return;
    loadRecords();
  }, [permissionLoading, hasAccess]);

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (stageFilter !== 'all' && r.stage !== stageFilter) return false;
      const term = searchTerm.trim().toLowerCase();
      if (!term) return true;
      return (
        r.employee.name.toLowerCase().includes(term) ||
        r.employee.workEmail.toLowerCase().includes(term) ||
        r.employee.employeeCode.toLowerCase().includes(term)
      );
    });
  }, [records, stageFilter, searchTerm]);

  if (permissionLoading || !hasAccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-['Inter']">
      <div className="bg-white border-b border-gray-200 px-4 sm:px-8">
        <div className="flex gap-5">
          <button
            onClick={() => setTab('records')}
            className={`px-1 py-3 border-b-2 font-semibold transition-colors ${
              tab === 'records' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            New Hires
          </button>
          {isHrAdmin && (
            <button
              onClick={() => setTab('templates')}
              className={`px-1 py-3 border-b-2 font-semibold transition-colors ${
                tab === 'templates' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Checklist Templates
            </button>
          )}
          {isHrAdmin && (
            <button
              onClick={() => setTab('offerLetterTemplates')}
              className={`px-1 py-3 border-b-2 font-semibold transition-colors ${
                tab === 'offerLetterTemplates' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Offer Letter Templates
            </button>
          )}
          {isHrAdmin && (
            <button
              onClick={() => setTab('access')}
              className={`px-1 py-3 border-b-2 font-semibold transition-colors ${
                tab === 'access' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Access
            </button>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-8">
        {tab === 'records' && (
          <RecordsTab
            records={filteredRecords}
            isLoading={isLoading}
            error={error}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            stageFilter={stageFilter}
            onStageFilterChange={setStageFilter}
            isHrAdmin={isHrAdmin}
            onAddClick={() => setShowAddModal(true)}
          />
        )}
        {tab === 'templates' && isHrAdmin && <TemplatesTab />}
        {tab === 'offerLetterTemplates' && isHrAdmin && <OfferLetterTemplatesTab />}
        {tab === 'access' && isHrAdmin && <AccessTab />}
      </div>

      {showAddModal && (
        <AddNewHireModal
          onClose={() => setShowAddModal(false)}
          onCreated={() => {
            setShowAddModal(false);
            loadRecords();
          }}
        />
      )}
    </div>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div
        className="h-full bg-purple-600 rounded-full transition-all"
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  );
}

function RecordsTab({
  records,
  isLoading,
  error,
  searchTerm,
  onSearchChange,
  stageFilter,
  onStageFilterChange,
  isHrAdmin,
  onAddClick,
}: {
  records: OnboardingRecordListItem[];
  isLoading: boolean;
  error: string | null;
  searchTerm: string;
  onSearchChange: (v: string) => void;
  stageFilter: OnboardingStage | 'all';
  onStageFilterChange: (v: OnboardingStage | 'all') => void;
  isHrAdmin: boolean;
  onAddClick: () => void;
}) {
  return (
    <>
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex-1 relative w-full sm:w-auto">
          <input
            type="text"
            placeholder="Search by name, email, or employee code..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-4 pr-4 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {STAGE_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => onStageFilterChange(f.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                stageFilter === f.value ? 'bg-purple-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-purple-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {isHrAdmin && (
          <button
            onClick={onAddClick}
            className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold text-sm hover:bg-purple-700 transition-colors shrink-0"
          >
            <PlusIcon className="w-4 h-4" />
            Add New Hire
          </button>
        )}
      </div>

      {isLoading && <p className="text-gray-500 text-sm">Loading onboarding records...</p>}
      {error && !isLoading && <p className="text-red-600 text-sm">{error}</p>}
      {!isLoading && !error && records.length === 0 && (
        <p className="text-gray-500 text-sm">No new hires found.</p>
      )}

      {!isLoading && !error && records.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {records.map((r) => (
            <Link
              key={r.id}
              href={`/onboarding/${r.id}`}
              className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-lg transition-shadow block"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-bold text-gray-900 text-lg">{r.employee.name}</h3>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${STAGE_COLOR[r.stage]}`}>
                  {STAGE_LABEL[r.stage]}
                </span>
              </div>
              <p className="text-gray-500 text-sm mb-3">{r.employee.workEmail}</p>
              <p className="text-gray-600 text-sm mb-1">Joining: {formatDate(r.joiningDate)}</p>
              {r.offerLetter && (
                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                  <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${OFFER_STATUS_COLOR[r.offerLetter.status]}`}>
                    {OFFER_STATUS_LABEL[r.offerLetter.status]}
                  </span>
                  <span className="text-[11px] text-gray-400">{offerNextAction(r.offerLetter.status)}</span>
                </div>
              )}
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>Checklist progress</span>
                  <span>{r.progress.completed}/{r.progress.total}</span>
                </div>
                <ProgressBar percent={r.progress.percent} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

function AddNewHireModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [departments, setDepartments] = useState<NamedEntity[]>([]);
  const [designations, setDesignations] = useState<NamedEntity[]>([]);
  const [employees, setEmployees] = useState<EmployeeLookupItem[]>([]);
  const [offerTemplates, setOfferTemplates] = useState<OfferLetterTemplate[]>([]);
  const [showManageOrg, setShowManageOrg] = useState(false);
  const [form, setForm] = useState<CreateNewHireInput>({
    firstName: '',
    lastName: '',
    workEmail: '',
    personalEmail: '',
    phone: '',
    joiningDate: '',
    basicSalary: 0,
    hra: 0,
    otherAllowances: 0,
    otherComponents: 0,
    currency: 'INR',
    employmentType: 'full_time',
    probationPeriodMonths: 3,
    noticePeriodDays: 30,
    offerLetterTemplateId: null,
    temporaryPassword: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOrgFields = () => {
    fetchJson<NamedEntity[]>('/api/departments').then(setDepartments).catch(() => {});
    fetchJson<NamedEntity[]>('/api/designations').then(setDesignations).catch(() => {});
  };

  useEffect(() => {
    loadOrgFields();
    fetchJson<EmployeeLookupItem[]>('/api/employees/lookup').then(setEmployees).catch(() => {});
    onboardingApi
      .getOfferLetterTemplates()
      .then((templates) => {
        setOfferTemplates(templates);
        const def = templates.find((t) => t.isDefault);
        if (def) setForm((f) => ({ ...f, offerLetterTemplateId: def.id }));
      })
      .catch(() => {});
  }, []);

  const update = (patch: Partial<CreateNewHireInput>) => setForm((f) => ({ ...f, ...patch }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.firstName || !form.lastName || !form.workEmail || !form.joiningDate) {
      setError('First name, last name, work email, and joining date are required.');
      return;
    }
    if (!form.personalEmail) {
      setError('Personal email is required — it’s how we reach the new hire before their work account exists.');
      return;
    }
    const totalCtc = (form.basicSalary || 0) + (form.hra || 0) + (form.otherAllowances || 0) + (form.otherComponents || 0);
    if (totalCtc <= 0) {
      setError('Enter a salary — at least one component (Basic Salary, HRA, etc.) must be greater than 0.');
      return;
    }
    setSubmitting(true);
    try {
      await onboardingApi.createRecord(form);
      onCreated();
    } catch (e) {
      setError(e instanceof OnboardingApiError ? e.message : 'Failed to create new hire');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-gray-900 mb-4">Add New Hire</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name *">
              <input
                className="input"
                value={form.firstName}
                onChange={(e) => update({ firstName: e.target.value })}
              />
            </Field>
            <Field label="Last name *">
              <input
                className="input"
                value={form.lastName}
                onChange={(e) => update({ lastName: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Work email *">
            <input
              type="email"
              className="input"
              value={form.workEmail}
              onChange={(e) => update({ workEmail: e.target.value })}
            />
          </Field>
          <Field label="Personal email (for pre-Day-1 contact) *">
            <input
              type="email"
              required
              className="input"
              value={form.personalEmail}
              onChange={(e) => update({ personalEmail: e.target.value })}
              placeholder="Reaches them before their work account exists"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <input className="input" value={form.phone} onChange={(e) => update({ phone: e.target.value })} />
            </Field>
            <Field label="Joining date *">
              <input
                type="date"
                className="input"
                value={form.joiningDate}
                onChange={(e) => update({ joiningDate: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Department">
              <select
                className="input"
                value={form.departmentId ?? ''}
                onChange={(e) => update({ departmentId: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">—</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Designation">
              <select
                className="input"
                value={form.designationId ?? ''}
                onChange={(e) => update({ designationId: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">—</option>
                {designations.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </Field>
          </div>
          <button
            type="button"
            onClick={() => setShowManageOrg(true)}
            className="text-purple-600 text-xs font-semibold hover:underline -mt-2"
          >
            + Add / remove departments &amp; designations
          </button>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Manager">
              <select
                className="input"
                value={form.managerId ?? ''}
                onChange={(e) => update({ managerId: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">—</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Buddy">
              <select
                className="input"
                value={form.buddyId ?? ''}
                onChange={(e) => update({ buddyId: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">—</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 mt-3">
              Salary structure (annual) — generates a draft offer letter automatically
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Basic Salary *">
              <input
                type="number"
                min={0}
                step="1000"
                className="input"
                value={form.basicSalary || ''}
                onChange={(e) => update({ basicSalary: Number(e.target.value) })}
                placeholder="e.g. 900000"
              />
            </Field>
            <Field label="HRA">
              <input
                type="number"
                min={0}
                step="1000"
                className="input"
                value={form.hra || ''}
                onChange={(e) => update({ hra: Number(e.target.value) })}
                placeholder="e.g. 200000"
              />
            </Field>
            <Field label="Other Allowances">
              <input
                type="number"
                min={0}
                step="1000"
                className="input"
                value={form.otherAllowances || ''}
                onChange={(e) => update({ otherAllowances: Number(e.target.value) })}
              />
            </Field>
            <Field label="Other Components">
              <input
                type="number"
                min={0}
                step="1000"
                className="input"
                value={form.otherComponents || ''}
                onChange={(e) => update({ otherComponents: Number(e.target.value) })}
              />
            </Field>
          </div>
          <div className="flex items-center justify-between bg-purple-50 border border-purple-100 rounded-lg px-3 py-2">
            <span className="text-xs font-semibold text-purple-700">Total CTC (annual)</span>
            <span className="text-sm font-bold text-purple-900">
              {form.currency} {((form.basicSalary || 0) + (form.hra || 0) + (form.otherAllowances || 0) + (form.otherComponents || 0)).toLocaleString('en-IN')}
            </span>
          </div>
          <Field label="Currency">
            <input
              className="input"
              value={form.currency}
              onChange={(e) => update({ currency: e.target.value.toUpperCase() })}
              maxLength={3}
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Employment type">
              <select
                className="input"
                value={form.employmentType}
                onChange={(e) => update({ employmentType: e.target.value as EmploymentType })}
              >
                {(Object.keys(EMPLOYMENT_TYPE_LABEL) as EmploymentType[]).map((t) => (
                  <option key={t} value={t}>{EMPLOYMENT_TYPE_LABEL[t]}</option>
                ))}
              </select>
            </Field>
            <Field label="Probation (months)">
              <input
                type="number"
                min={0}
                className="input"
                value={form.probationPeriodMonths}
                onChange={(e) => update({ probationPeriodMonths: Number(e.target.value) })}
              />
            </Field>
            <Field label="Notice period (days)">
              <input
                type="number"
                min={0}
                className="input"
                value={form.noticePeriodDays}
                onChange={(e) => update({ noticePeriodDays: Number(e.target.value) })}
              />
            </Field>
          </div>

          <Field label="Offer letter template">
            <select
              className="input"
              value={form.offerLetterTemplateId ?? ''}
              onChange={(e) => update({ offerLetterTemplateId: e.target.value ? Number(e.target.value) : null })}
            >
              {offerTemplates.length === 0 && <option value="">Default</option>}
              {offerTemplates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}{t.isDefault ? ' (default)' : ''}</option>
              ))}
            </select>
          </Field>

          <Field label="Temporary password (leave blank to auto-generate)">
            <input
              className="input"
              value={form.temporaryPassword}
              onChange={(e) => update({ temporaryPassword: e.target.value })}
              placeholder="Auto-generated if left blank"
            />
          </Field>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 rounded-lg bg-purple-600 text-white font-semibold text-sm hover:bg-purple-700 disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Candidate & Generate Offer'}
            </button>
          </div>
        </form>
      </div>
      <style jsx global>{`
        .input {
          width: 100%;
          border: 1px solid #d1d5db;
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
        }
        .input:focus {
          outline: none;
          border-color: #9333ea;
        }
      `}</style>
      {showManageOrg && (
        <ManageOrgFieldsModal
          onClose={() => setShowManageOrg(false)}
          onChanged={loadOrgFields}
        />
      )}
    </div>
  );
}

function ManageOrgFieldsModal({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [departments, setDepartments] = useState<NamedEntity[]>([]);
  const [designations, setDesignations] = useState<NamedEntity[]>([]);
  const [newDept, setNewDept] = useState('');
  const [newDesig, setNewDesig] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    fetchJson<NamedEntity[]>('/api/departments').then(setDepartments).catch(() => {});
    fetchJson<NamedEntity[]>('/api/designations').then(setDesignations).catch(() => {});
  };

  useEffect(() => {
    load();
  }, []);

  const notifyChanged = () => {
    load();
    onChanged();
  };

  const postJson = async (url: string, body: unknown) => {
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) throw new Error(json?.error?.message || 'Request failed');
    return json.data;
  };

  const patchJson = async (url: string, body: unknown) => {
    const res = await fetch(url, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) throw new Error(json?.error?.message || 'Request failed');
    return json.data;
  };

  const removeAt = async (url: string) => {
    const res = await fetch(url, { method: 'DELETE', credentials: 'include' });
    if (!res.ok && res.status !== 204) {
      const json = await res.json().catch(() => null);
      throw new Error(json?.error?.message || 'Request failed');
    }
  };

  const addDepartment = async () => {
    if (!newDept.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await postJson('/api/departments', { name: newDept.trim() });
      setNewDept('');
      notifyChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add department');
    } finally {
      setBusy(false);
    }
  };

  const addDesignation = async () => {
    if (!newDesig.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await postJson('/api/designations', { name: newDesig.trim() });
      setNewDesig('');
      notifyChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add designation');
    } finally {
      setBusy(false);
    }
  };

  const renameDepartment = async (id: number, name: string) => {
    setBusy(true);
    setError(null);
    try {
      await patchJson(`/api/departments/${id}`, { name });
      notifyChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to rename department');
    } finally {
      setBusy(false);
    }
  };

  const renameDesignation = async (id: number, name: string) => {
    setBusy(true);
    setError(null);
    try {
      await patchJson(`/api/designations/${id}`, { name });
      notifyChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to rename designation');
    } finally {
      setBusy(false);
    }
  };

  const removeDepartment = async (id: number, name: string) => {
    if (!confirm(`Remove "${name}"? Employees already using it keep it — it just drops off the picker for new hires.`)) return;
    setBusy(true);
    setError(null);
    try {
      await removeAt(`/api/departments/${id}`);
      notifyChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove department');
    } finally {
      setBusy(false);
    }
  };

  const removeDesignation = async (id: number, name: string) => {
    if (!confirm(`Remove "${name}"? Employees already using it keep it — it just drops off the picker for new hires.`)) return;
    setBusy(true);
    setError(null);
    try {
      await removeAt(`/api/designations/${id}`);
      notifyChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove designation');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-900 mb-4">Departments &amp; Designations</h2>

        <div className="mb-5">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Departments</h3>
          <div className="flex gap-2 mb-2">
            <input
              className="input"
              placeholder="e.g. Engineering"
              value={newDept}
              onChange={(e) => setNewDept(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addDepartment())}
            />
            <button
              type="button"
              disabled={busy}
              onClick={addDepartment}
              className="px-3 py-2 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 shrink-0"
            >
              Add
            </button>
          </div>
          <div className="space-y-1.5">
            {departments.map((d) => (
              <OrgFieldRow key={d.id} item={d} onRename={(name) => renameDepartment(d.id, name)} onRemove={() => removeDepartment(d.id, d.name)} />
            ))}
            {departments.length === 0 && <p className="text-xs text-gray-400">No departments yet.</p>}
          </div>
        </div>

        <div className="mb-2">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Designations</h3>
          <div className="flex gap-2 mb-2">
            <input
              className="input"
              placeholder="e.g. Software Engineer"
              value={newDesig}
              onChange={(e) => setNewDesig(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addDesignation())}
            />
            <button
              type="button"
              disabled={busy}
              onClick={addDesignation}
              className="px-3 py-2 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 shrink-0"
            >
              Add
            </button>
          </div>
          <div className="space-y-1.5">
            {designations.map((d) => (
              <OrgFieldRow key={d.id} item={d} onRename={(name) => renameDesignation(d.id, name)} onRemove={() => removeDesignation(d.id, d.name)} />
            ))}
            {designations.length === 0 && <p className="text-xs text-gray-400">No designations yet.</p>}
          </div>
        </div>

        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}

        <div className="flex justify-end pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function OrgFieldRow({ item, onRename, onRemove }: { item: NamedEntity; onRename: (name: string) => void; onRemove: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.name);

  const commit = () => {
    setEditing(false);
    if (value.trim() && value.trim() !== item.name) onRename(value.trim());
    else setValue(item.name);
  };

  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-50 rounded-lg border border-gray-200">
      {editing ? (
        <input
          autoFocus
          className="flex-1 text-sm border-b border-purple-400 bg-transparent outline-none"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setValue(item.name);
              setEditing(false);
            }
          }}
        />
      ) : (
        <span className="flex-1 text-sm text-gray-800 truncate cursor-text" onClick={() => setEditing(true)}>
          {item.name}
        </span>
      )}
      <button type="button" onClick={() => setEditing(true)} className="text-purple-600 text-xs font-semibold hover:underline shrink-0">
        Rename
      </button>
      <button type="button" onClick={onRemove} className="text-red-600 text-xs font-semibold hover:underline shrink-0">
        Remove
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-gray-600 mb-1">{label}</span>
      {children}
    </label>
  );
}

const CATEGORY_OPTIONS: { value: TaskCategory; label: string }[] = [
  { value: 'preboarding', label: 'Preboarding' },
  { value: 'onboarding', label: 'Onboarding' },
];

const OWNER_OPTIONS: TaskOwner[] = ['new_hire', 'hr_admin', 'manager', 'buddy'];

function TemplatesTab() {
  const [templates, setTemplates] = useState<OnboardingTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<OnboardingTemplate | null>(null);

  const load = async () => {
    try {
      setIsLoading(true);
      setTemplates(await onboardingApi.getTemplates());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const deactivate = async (id: number) => {
    if (!confirm('Remove this template? Existing new hires keep tasks already generated from it.')) return;
    await onboardingApi.deactivateTemplate(id);
    load();
  };

  const renderGroup = (category: TaskCategory) => {
    const rows = templates.filter((t) => t.category === category).sort((a, b) => a.sortOrder - b.sortOrder);
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
        <h3 className="font-bold text-gray-900 mb-4">{category === 'preboarding' ? 'Preboarding checklist' : 'Onboarding checklist'}</h3>
        {rows.length === 0 ? (
          <p className="text-sm text-gray-500">No templates yet.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{t.title}</p>
                  <p className="text-xs text-gray-500">
                    {OWNER_LABEL[t.owner]} · Day {t.offsetDays >= 0 ? '+' : ''}{t.offsetDays} · {t.isRequired ? 'Required' : 'Optional'}
                    {t.requiresDocument ? ' · Needs document' : ''}
                    {t.assignee ? ` · Assigned to ${t.assignee.name}` : ''}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setEditing(t)} className="text-purple-600 text-sm font-semibold hover:underline">
                    Edit
                  </button>
                  <button onClick={() => deactivate(t.id)} className="text-red-600 text-sm font-semibold hover:underline">
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold text-sm hover:bg-purple-700 transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          Add Checklist Item
        </button>
      </div>

      {isLoading && <p className="text-gray-500 text-sm">Loading templates...</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {!isLoading && !error && (
        <>
          {renderGroup('preboarding')}
          {renderGroup('onboarding')}
        </>
      )}

      {(showAdd || editing) && (
        <TemplateModal
          template={editing}
          onClose={() => {
            setShowAdd(false);
            setEditing(null);
          }}
          onSaved={() => {
            setShowAdd(false);
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function TemplateModal({
  template,
  onClose,
  onSaved,
}: {
  template: OnboardingTemplate | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<TemplateInput>(
    template
      ? {
          category: template.category,
          title: template.title,
          description: template.description,
          owner: template.owner,
          isRequired: template.isRequired,
          requiresDocument: template.requiresDocument,
          offsetDays: template.offsetDays,
          sortOrder: template.sortOrder,
          assigneeId: template.assigneeId,
        }
      : {
          category: 'preboarding',
          title: '',
          description: '',
          owner: 'new_hire',
          isRequired: true,
          requiresDocument: false,
          offsetDays: 0,
          sortOrder: 0,
          assigneeId: null,
        },
  );
  const employees = useEmployeeOptions();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (patch: Partial<TemplateInput>) => setForm((f) => ({ ...f, ...patch }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('Title is required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (template) {
        await onboardingApi.updateTemplate(template.id, form);
      } else {
        await onboardingApi.createTemplate(form);
      }
      onSaved();
    } catch (e) {
      setError(e instanceof OnboardingApiError ? e.message : 'Failed to save template');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-900 mb-4">{template ? 'Edit checklist item' : 'Add checklist item'}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="Title *">
            <input className="input" value={form.title} onChange={(e) => update({ title: e.target.value })} />
          </Field>
          <Field label="Description">
            <textarea
              className="input"
              rows={2}
              value={form.description}
              onChange={(e) => update({ description: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <select className="input" value={form.category} onChange={(e) => update({ category: e.target.value as TaskCategory })}>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Owner">
              <select className="input" value={form.owner} onChange={(e) => update({ owner: e.target.value as TaskOwner })}>
                {OWNER_OPTIONS.map((o) => (
                  <option key={o} value={o}>{OWNER_LABEL[o]}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Offset days from joining date">
              <input
                type="number"
                className="input"
                value={form.offsetDays}
                onChange={(e) => update({ offsetDays: Number(e.target.value) })}
              />
            </Field>
            <Field label="Sort order">
              <input
                type="number"
                className="input"
                value={form.sortOrder}
                onChange={(e) => update({ sortOrder: Number(e.target.value) })}
              />
            </Field>
          </div>
          <Field label="Default assignee (optional)">
            <select
              className="input"
              value={form.assigneeId ?? ''}
              onChange={(e) => update({ assigneeId: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">No one — the owner role handles it</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name} ({emp.employeeCode})</option>
              ))}
            </select>
            <span className="block text-[11px] text-gray-400 mt-1">
              e.g. your IT admin for laptop setup. They&apos;re emailed when the task is created and can mark it done.
            </span>
          </Field>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.isRequired} onChange={(e) => update({ isRequired: e.target.checked })} />
              Required
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.requiresDocument}
                onChange={(e) => update({ requiresDocument: e.target.checked })}
              />
              Needs document
            </label>
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 rounded-lg bg-purple-600 text-white font-semibold text-sm hover:bg-purple-700 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function useEmployeeOptions(): EmployeeLookupItem[] {
  const [employees, setEmployees] = useState<EmployeeLookupItem[]>([]);
  useEffect(() => {
    fetchJson<EmployeeLookupItem[]>('/api/employees/lookup').then(setEmployees).catch(() => setEmployees([]));
  }, []);
  return employees;
}

const ACCESS_AREA_HINT: Record<AccessArea, string> = {
  bank_details: 'e.g. your payroll person — sees account details for salary setup.',
  identity_documents: 'Aadhaar, PAN and other IDs, with the uploaded scans.',
  education: 'Degrees, certificates and marks.',
};

function AccessTab() {
  const [data, setData] = useState<{ areas: { value: AccessArea; label: string }[]; grants: AccessGrant[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const employees = useEmployeeOptions();

  const load = async () => {
    try {
      setData(await onboardingApi.getAccessGrants());
    } catch (e) {
      setError(e instanceof OnboardingApiError ? e.message : 'Failed to load access');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const add = async (area: AccessArea) => {
    const employeeId = adding[area];
    if (!employeeId) return;
    setBusy(true);
    setError(null);
    try {
      await onboardingApi.addAccessGrant(area, Number(employeeId));
      setAdding((a) => ({ ...a, [area]: '' }));
      await load();
    } catch (e) {
      setError(e instanceof OnboardingApiError ? e.message : 'Failed to grant access');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (grant: AccessGrant) => {
    if (!confirm(`Remove ${grant.name}'s access to ${grant.areaDisplay.toLowerCase()}?`)) return;
    setBusy(true);
    try {
      await onboardingApi.removeAccessGrant(grant.id);
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <p className="text-sm text-gray-500">{error ?? 'Loading…'}</p>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Give named people access to one area of every new hire&apos;s data, on top of HR. They see it (read-only) under
        <strong> Onboarding tasks</strong> in their menu; showing full numbers is audited. To give someone a checklist task
        instead (e.g. IT for laptop setup), set an assignee on the task in <strong>Checklist Templates</strong> or on a new hire&apos;s record.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {data.areas.map((area) => {
        const grants = data.grants.filter((g) => g.area === area.value);
        return (
          <div key={area.value} className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-bold text-gray-900">{area.label}</h3>
            <p className="text-xs text-gray-500 mb-3">{ACCESS_AREA_HINT[area.value]}</p>
            {grants.length === 0 ? (
              <p className="text-sm text-gray-400 mb-3">Only HR (and the Finance role) can see this.</p>
            ) : (
              <div className="space-y-2 mb-3">
                {grants.map((g) => (
                  <div key={g.id} className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{g.name}</p>
                      <p className="text-xs text-gray-500 truncate">{g.email}</p>
                    </div>
                    <button onClick={() => remove(g)} disabled={busy} className="text-red-600 text-sm font-semibold hover:underline shrink-0">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <select
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={adding[area.value] ?? ''}
                onChange={(e) => setAdding((a) => ({ ...a, [area.value]: e.target.value }))}
              >
                <option value="">Add a person…</option>
                {employees
                  .filter((emp) => !grants.some((g) => g.employeeId === emp.id))
                  .map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.employeeCode})</option>
                  ))}
              </select>
              <button
                onClick={() => add(area.value)}
                disabled={busy || !adding[area.value]}
                className="px-4 py-2 rounded-lg bg-purple-600 text-white font-semibold text-sm hover:bg-purple-700 disabled:opacity-50"
              >
                Give access
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OfferLetterTemplatesTab() {
  const [templates, setTemplates] = useState<OfferLetterTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<OfferLetterTemplate | null>(null);

  const load = async () => {
    try {
      setIsLoading(true);
      setTemplates(await onboardingApi.getOfferLetterTemplates());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load offer letter templates');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (id: number) => {
    if (!confirm('Remove this template?')) return;
    try {
      await onboardingApi.deactivateOfferLetterTemplate(id);
      load();
    } catch (e) {
      alert(e instanceof OnboardingApiError ? e.message : 'Failed to remove template');
    }
  };

  const makeDefault = async (id: number) => {
    try {
      await onboardingApi.updateOfferLetterTemplate(id, { isDefault: true });
      load();
    } catch (e) {
      alert(e instanceof OnboardingApiError ? e.message : 'Failed to set default');
    }
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-4 gap-4">
        <p className="text-sm text-gray-500 max-w-xl">
          These are the offer letters HR sends new hires. Pick one per hire in the &quot;Add New Hire&quot; form —
          e.g. a different template for interns vs. full-time roles.
        </p>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold text-sm hover:bg-purple-700 transition-colors shrink-0"
        >
          <PlusIcon className="w-4 h-4" />
          Add Template
        </button>
      </div>

      {isLoading && <p className="text-gray-500 text-sm">Loading templates...</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {!isLoading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((t) => (
            <div key={t.id} className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-bold text-gray-900">{t.name}</h3>
                  <p className="text-xs text-gray-500">{t.heading}</p>
                </div>
                {t.isDefault && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 shrink-0">
                    Default
                  </span>
                )}
              </div>
              {t.sourceDocxName ? (
                <div className="flex items-center gap-2 text-sm">
                  <FileTextIcon className="w-4 h-4 text-purple-600 shrink-0" />
                  {t.sourceDocxUrl ? (
                    <a href={t.sourceDocxUrl} target="_blank" rel="noreferrer" className="text-purple-600 hover:underline truncate">
                      {t.sourceDocxName}
                    </a>
                  ) : (
                    <span className="text-gray-600 truncate">{t.sourceDocxName}</span>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-600 whitespace-pre-wrap line-clamp-4">{t.body}</p>
              )}
              <div className="flex gap-3 mt-4 pt-3 border-t border-gray-100">
                <button onClick={() => setEditing(t)} className="text-purple-600 text-sm font-semibold hover:underline">
                  Edit
                </button>
                {!t.isDefault && (
                  <button onClick={() => makeDefault(t.id)} className="text-gray-600 text-sm font-semibold hover:underline">
                    Make default
                  </button>
                )}
                <button onClick={() => remove(t.id)} className="text-red-600 text-sm font-semibold hover:underline ml-auto">
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(showAdd || editing) && (
        <OfferLetterTemplateModal
          template={editing}
          onClose={() => {
            setShowAdd(false);
            setEditing(null);
          }}
          onSaved={() => {
            setShowAdd(false);
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function OfferLetterTemplateModal({
  template,
  onClose,
  onSaved,
}: {
  template: OfferLetterTemplate | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<OfferLetterTemplateInput>(
    template
      ? { name: template.name, heading: template.heading, body: template.body, isDefault: template.isDefault }
      : { name: '', heading: 'Offer of Employment', body: '', isDefault: false },
  );
  const [file, setFile] = useState<File | null>(null);
  const [removeExistingFile, setRemoveExistingFile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasExistingFile = !!template?.sourceDocxName && !removeExistingFile;
  const usingWordFile = hasExistingFile || !!file;

  const placeholders = template?.placeholders ?? [
    'first_name', 'last_name', 'full_name', 'designation', 'department', 'employee_code',
    'joining_date', 'package', 'monthly_package', 'employment_type', 'probation_period_months',
    'notice_period_days', 'today', 'reporting_manager',
  ];

  const insertPlaceholder = (name: string) => {
    setForm((f) => ({ ...f, body: `${f.body ?? ''}{{${name}}}` }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Template name is required.');
      return;
    }
    if (!usingWordFile && !file && !form.body?.trim()) {
      setError('Upload a Word (.docx) template or type a letter body.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (template) {
        await onboardingApi.updateOfferLetterTemplate(
          template.id,
          { ...form, removeSourceDocx: removeExistingFile && !file },
          file,
        );
      } else {
        await onboardingApi.createOfferLetterTemplate(form, file);
      }
      onSaved();
    } catch (e) {
      setError(e instanceof OnboardingApiError ? e.message : 'Failed to save template');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-900 mb-4">{template ? 'Edit offer letter template' : 'Add offer letter template'}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Template name *">
              <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Contractor Offer" />
            </Field>
            <Field label="Letter heading">
              <input className="input" value={form.heading} onChange={(e) => setForm((f) => ({ ...f, heading: e.target.value }))} />
            </Field>
          </div>

          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
            <span className="block text-xs font-semibold text-gray-600 mb-2">Upload a Word (.docx) template</span>
            {hasExistingFile ? (
              <div className="flex items-center gap-2 text-sm">
                <FileTextIcon className="w-4 h-4 text-purple-600 shrink-0" />
                <span className="text-gray-700 truncate flex-1">{template!.sourceDocxName}</span>
                <button
                  type="button"
                  onClick={() => setRemoveExistingFile(true)}
                  className="text-red-600 text-xs font-semibold hover:underline shrink-0"
                >
                  Remove
                </button>
              </div>
            ) : (
              <>
                <input
                  type="file"
                  accept=".docx"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="text-sm w-full"
                />
                <p className="text-xs text-gray-400 mt-1.5">
                  Type placeholders like <code className="font-mono">{'{{first_name}}'}</code> directly into your Word document —
                  they get filled in and the letter is sent as a PDF, with your formatting, logo and letterhead intact.
                </p>
              </>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="block text-xs font-semibold text-gray-600">
                Letter body {usingWordFile ? '(not used — a Word file is attached above)' : '*'}
              </span>
              <span className="text-xs text-gray-400">Blank line = new paragraph · **bold** · click a placeholder to insert</span>
            </div>
            <textarea
              className={`input font-mono text-xs ${usingWordFile ? 'opacity-50' : ''}`}
              rows={usingWordFile ? 4 : 14}
              value={form.body ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              placeholder={'Dear {{first_name}} {{last_name}},\n\nWe are pleased to offer you...'}
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {placeholders.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => insertPlaceholder(p)}
                  className="px-2 py-1 rounded-md bg-gray-100 text-gray-700 text-xs font-mono hover:bg-purple-100 hover:text-purple-700"
                >
                  {`{{${p}}}`}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.isDefault ?? false}
              onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
            />
            Use as the default template for new hires
          </label>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="flex-1 px-4 py-2 rounded-lg bg-purple-600 text-white font-semibold text-sm hover:bg-purple-700 disabled:opacity-50">
              {submitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
