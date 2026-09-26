import { NextRequest, NextResponse } from 'next/server';
import { proxyToBackend, setAuthCookies, clearAuthCookies } from '@/lib/api/proxy';
import { MOCK_AUTH_ENABLED, MOCK_REFRESH_TOKEN, MOCK_USER, getMockUserByEmail } from '@/lib/api/mock-auth';

// Previously this file guessed the frontend archetype from the backend
// role's free-text *name* via a hardcoded table (`{employee: 'employee',
// admin: 'admin', 'super admin': 'superadmin'}`). That broke the moment the
// backend's real role names turned out to be Employee/Manager/HR Admin/Finance
// (docs/REQUIREMENTS.md §0) instead of Employee/Admin/Super Admin — "manager"
// and "hr admin" aren't in the table, so both silently fell through to the
// `|| 'employee'` default, quietly stripping HR Admin and Finance users of
// their admin/superadmin UI entirely. The backend now sends `roles[0].archetype`
// explicitly instead (one of exactly the 3 values this frontend understands:
// employee/admin/superadmin — see backend/core/enums.py's RoleArchetype), so
// there's no name-guessing table to keep in sync as roles change or new
// custom roles get created.
function archetypeFromRoles(roles: { name?: string; archetype?: string }[] | undefined): string {
  const archetype = roles?.[0]?.archetype;
  if (archetype === 'admin' || archetype === 'superadmin' || archetype === 'employee') {
    return archetype;
  }
  return 'employee';
}

export async function GET(req: NextRequest) {
  try {
    if (MOCK_AUTH_ENABLED) {
      const hasSession = req.cookies.get('refreshToken')?.value === MOCK_REFRESH_TOKEN;
      if (!hasSession) {
        return NextResponse.json(
          { success: false, error: { message: 'Unauthorized' } },
          { status: 401 }
        );
      }
      // Per-role mock users: the email chosen at mock login (see mock-auth.ts).
      const userEmail = req.cookies.get('mockUserEmail')?.value;
      const mockUser = userEmail ? getMockUserByEmail(userEmail) : MOCK_USER;
      return NextResponse.json({
        success: true,
        data: {
          id: mockUser.id,
          email: mockUser.email,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName,
          role: archetypeFromRoles(mockUser.roles),
          permissions: mockUser.permissions,
          scope: mockUser.scope,
          mustChangePassword: false,
        },
      });
    }

    const { status, body, rotated, sessionExpired } = await proxyToBackend(
      req,
      '/users/me'
    );

    if (sessionExpired || status === 401) {
      const resp = NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      );
      clearAuthCookies(resp);
      return resp;
    }

    if (status < 200 || status >= 300 || !body?.data) {
      return NextResponse.json(
        body ?? { success: false, error: { message: 'Failed to get user' } },
        { status: status || 502 }
      );
    }

    const u = body.data;

    const resp = NextResponse.json({
      success: true,
      data: {
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        role: archetypeFromRoles(u.roles),
        permissions: u.permissions || [],
        // {kind:'org'} / {kind:'team', employeeIds} / {kind:'self'} - the one
        // resolved scope value for this user's requests (see backend
        // core/scope.py::resolve_management_scope). Falls back to self,
        // matching the backend's own fail-closed default, for callers against
        // an older backend that doesn't send it yet.
        scope: u.scope || { kind: 'self' },
        // Forced temporary-password change gate (T06): an admin-issued
        // password must be replaced before the user reaches the app.
        // Defaults to false for older backends that don't send it yet.
        mustChangePassword: u.mustChangePassword ?? false,
      },
    });

    if (rotated) {
      setAuthCookies(resp, rotated.accessToken, rotated.refreshToken);
    }

    return resp;
  } catch (err) {
    console.error('[api/auth/me] failed:', err);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to get user' } },
      { status: 500 }
    );
  }
}
