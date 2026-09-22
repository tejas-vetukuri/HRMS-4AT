/**
 * Temporary auth bypass for local frontend work while the Django backend
 * (see docs/TASKS.md Phase 1) doesn't exist yet. Enabled via `MOCK_AUTH=true`
 * in `.env.local`. Every route handler under `app/api/auth/*` and
 * `app/api/users/me` checks this flag first and, when on, short-circuits
 * before ever calling `BACKEND_API_URL` - the real login screen, AuthProvider,
 * and cookie-based session flow all run unmodified against these fake values.
 *
 * Login with any of the test emails below to get different roles:
 * - admin@company.com → HR Admin (org-wide scope)
 * - manager@company.com → Manager (team scope)
 * - employee@company.com → Employee (self scope)
 *
 * Remove all `MOCK_AUTH_ENABLED` branches (and this file) once the real
 * backend's `/auth/*` and `/users/me` endpoints are live.
 */
export const MOCK_AUTH_ENABLED = process.env.MOCK_AUTH === 'true';

export const MOCK_ACCESS_TOKEN = 'mock-access-token';
export const MOCK_REFRESH_TOKEN = 'mock-refresh-token';

type MockUserRole = 'admin' | 'manager' | 'employee' | 'finance';

export interface MockUserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: Array<{ name: MockUserRole }>;
  permissions: string[];
  scope: { kind: 'org' | 'team' | 'self'; employeeIds?: string[] };
}

export const MOCK_USERS: Record<string, MockUserProfile> = {
  admin: {
    id: 'mock-admin-1',
    email: 'admin@company.com',
    firstName: 'Admin',
    lastName: 'User',
    roles: [{ name: 'admin' }],
    permissions: [
      'employee.read',
      'employee.write',
      'attendance.read.self',
      'attendance.read.team',
      'attendance.approve',
      'leave.read',
      'leave.approve',
      'expense.read',
      'expense.approve',
      'payroll.read',
      'performance.read',
      'performance.approve',
      'scope.all',
    ],
    scope: { kind: 'org' },
  },
  manager: {
    id: 'mock-manager-1',
    email: 'manager@company.com',
    firstName: 'Manager',
    lastName: 'User',
    roles: [{ name: 'manager' }],
    permissions: [
      'employee.read',
      'attendance.read.self',
      'attendance.read.team',
      'attendance.approve',
      'leave.read',
      'leave.approve',
      'expense.read',
      'expense.approve',
    ],
    scope: { kind: 'team', employeeIds: ['emp-002', 'emp-003', 'emp-004'] },
  },
  employee: {
    id: 'mock-employee-1',
    email: 'employee@company.com',
    firstName: 'Employee',
    lastName: 'User',
    roles: [{ name: 'employee' }],
    permissions: [
      'employee.read.self',
      'attendance.read.self',
      'leave.read.self',
      'leave.write',
      'expense.read.self',
      'expense.write',
      'payroll.read.self',
      'performance.read.self',
    ],
    scope: { kind: 'self' },
  },
  finance: {
    id: 'mock-finance-1',
    email: 'finance@company.com',
    firstName: 'Finance',
    lastName: 'User',
    roles: [{ name: 'finance' }],
    permissions: [
      'payroll.read',
      'payroll.write',
      'expense.read',
      'expense.approve',
      'employee.read',
      'scope.all',
    ],
    scope: { kind: 'org' },
  },
};

// Default mock user (when email doesn't match any role-specific user)
export const MOCK_USER = MOCK_USERS.admin;

/**
 * Get mock user by email, or return default admin if not found
 */
export function getMockUserByEmail(email: string): MockUserProfile {
  const emailLower = email.toLowerCase();

  // Try exact match
  for (const user of Object.values(MOCK_USERS)) {
    if (user.email.toLowerCase() === emailLower) {
      return user;
    }
  }

  // Default to admin if no match
  return MOCK_USER;
}
