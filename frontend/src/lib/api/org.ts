/**
 * Browser-side Org API client. Talks only to the local `/api/*` route
 * handlers (never the backend directly); those proxy to the backend and
 * carry the httpOnly session cookie.
 *
 * The backend returns snake_case `{success, data}` envelopes with `data` as
 * a bare array for these read-only reference lists (see
 * backend/employees/views.py `FrontendEnvelopeMixin`); this client keeps
 * that shape instead of mapping to camelCase.
 */

export interface OrgEmployee {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  work_email: string;
  department_id: string | null;
  designation_id: string | null;
  location_id: string | null;
  manager_id: string | null;
  legal_entity_id: string | null;
  business_unit_id: string | null;
  cost_center_id: string | null;
  status: string;
  employment_type: string;
  date_of_joining: string | null;
  date_of_exit: string | null;
}

export interface NamedEntity {
  id: string;
  name: string;
}

export interface CostCenter {
  id: string;
  name: string;
  code: string;
}

/** Read shapes for the Wave-1 Job Architecture + Team lists (snake_case). */
export interface Team {
  id: string;
  name: string;
  department_id: string | null;
  lead_id: string | null;
}

export interface JobFamily {
  id: string;
  name: string;
}

export interface Level {
  id: string;
  name: string;
}

export interface Grade {
  id: string;
  name: string;
}

export type PositionStatus = 'filled' | 'vacant' | 'hiring' | 'on_hold';

export interface Position {
  id: string;
  name: string;
  department_id: string | null;
  job_title_id: string | null;
  level_id: string | null;
  grade_id: string | null;
  business_unit_id: string | null;
  reports_to_id: string | null;
  status: PositionStatus;
  incumbent_id: string | null;
  is_active: boolean;
}

/**
 * One row from an `org/*` admin endpoint. The backend renders admin
 * responses camelCase and paginates them; only the fields a screen needs
 * are declared, everything else is ignored.
 */
export interface OrgAdminRow {
  id: string | number;
  name: string;
  isActive?: boolean;
  is_active?: boolean;
  employeeCount?: number;
  employee_count?: number;
  positionCount?: number;
  position_count?: number;
  parent?: string | number | null;
  parentName?: string | null;
  department?: string | number | null;
  departmentName?: string | null;
  lead?: string | number | null;
  leadName?: string | null;
  jobTitle?: string | number | null;
  jobTitleName?: string | null;
  level?: string | number | null;
  levelName?: string | null;
  grade?: string | number | null;
  gradeName?: string | null;
  businessUnit?: string | number | null;
  businessUnitName?: string | null;
  reportsTo?: string | number | null;
  reportsToName?: string | null;
  incumbent?: string | number | null;
  incumbentName?: string | null;
  status?: string;
}

export function adminRowId(row: OrgAdminRow): string {
  return String(row.id);
}

export function adminIsActive(row: OrgAdminRow): boolean {
  return row.isActive ?? row.is_active ?? true;
}

export function adminEmployeeCount(row: OrgAdminRow): number {
  return row.employeeCount ?? row.employee_count ?? 0;
}

interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: { code?: string; message?: string | string[] };
}

/** Thrown for any non-2xx local API response; `message` is backend-friendly. */
export class OrgApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'OrgApiError';
  }
}

async function request<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: 'include' });

  let json: Envelope<T> | null = null;
  try {
    json = (await res.json()) as Envelope<T>;
  } catch {
    json = null;
  }

  if (!res.ok || !json?.success) {
    const raw = json?.error?.message;
    const message = Array.isArray(raw)
      ? raw.join(', ')
      : raw || `Request failed (${res.status})`;

    // The proxy already cleared the auth cookies — send the user to sign in
    // rather than surfacing a generic error inside the UI.
    if (res.status === 401 && typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new OrgApiError(message, res.status);
  }

  const data = json.data as T;
  // Defensive: accept either a bare array or a paginated {results} wrapper.
  if (Array.isArray(data)) return data;
  if (data !== null && typeof data === 'object') {
    const results = (data as unknown as { results?: unknown }).results;
    if (Array.isArray(results)) return results as T;
  }
  return data;
}

export function fullName(e: Pick<OrgEmployee, 'first_name' | 'last_name'>): string {
  return `${e.first_name ?? ''} ${e.last_name ?? ''}`.trim() || '—';
}

/** Extract a human message from the admin API's error shapes. */
function adminErrorMessage(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const err = (body as { error?: { message?: unknown } }).error;
    if (err && typeof err.message === 'string' && err.message) return err.message;
    if (Array.isArray(err?.message)) return err.message.join(', ');
    const detail = (body as { detail?: unknown }).detail;
    if (typeof detail === 'string' && detail) return detail;
    // DRF field errors: {name: ["..."], department: ["..."]}.
    const fields = Object.entries(body as Record<string, unknown>)
      .filter(([k]) => k !== 'success' && k !== 'error' && k !== 'detail')
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`);
    if (fields.length > 0) return fields.join('; ');
  }
  return `Request failed (${status})`;
}

async function mutate<T>(path: string, method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  // A successful DELETE is a 204 with no body.
  if (res.status === 204) return undefined as T;

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new OrgApiError(adminErrorMessage(json, res.status), res.status);
  }

  // Admin writes return the (camelCase) object; admin lists are paginated.
  if (json !== null && typeof json === 'object') {
    const results = (json as { results?: unknown }).results;
    if (Array.isArray(results)) return results as T;
    const data = (json as { data?: unknown }).data;
    if (data !== undefined) return data as T;
  }
  return json as T;
}

/**
 * Mutations against the `org/*` admin viewsets (gated by `org.manage` on
 * the backend). Reached through the existing `/api/admin` catch-all proxy,
 * so no per-resource proxy route is needed. Lists request pageSize=100 to
 * defeat the default page size of 20.
 */
export const orgAdminApi = {
  list: (resource: string) =>
    mutate<OrgAdminRow[]>(`/api/admin/org/${resource}/?pageSize=100`, 'GET'),
  create: (resource: string, payload: Record<string, unknown>) =>
    mutate<OrgAdminRow>(`/api/admin/org/${resource}/`, 'POST', payload),
  update: (resource: string, id: string, payload: Record<string, unknown>) =>
    mutate<OrgAdminRow>(`/api/admin/org/${resource}/${id}/`, 'PATCH', payload),
  deactivate: (resource: string, id: string) =>
    mutate<OrgAdminRow>(`/api/admin/org/${resource}/${id}/`, 'PATCH', { is_active: false }),
  remove: (resource: string, id: string) =>
    mutate<void>(`/api/admin/org/${resource}/${id}/`, 'DELETE'),
};

export const orgApi = {
  listEmployees: () => request<OrgEmployee[]>('/api/employees'),
  listDepartments: () => request<NamedEntity[]>('/api/departments'),
  listDesignations: () => request<NamedEntity[]>('/api/designations'),
  listLocations: () => request<NamedEntity[]>('/api/locations'),
  listLegalEntities: () => request<NamedEntity[]>('/api/legal-entities'),
  listBusinessUnits: () => request<NamedEntity[]>('/api/business-units'),
  listCostCenters: () => request<CostCenter[]>('/api/cost-centers'),
  listTeams: () => request<Team[]>('/api/teams'),
  listJobFamilies: () => request<JobFamily[]>('/api/job-families'),
  listLevels: () => request<Level[]>('/api/levels'),
  listGrades: () => request<Grade[]>('/api/grades'),
  listPositions: () => request<Position[]>('/api/positions'),
};
