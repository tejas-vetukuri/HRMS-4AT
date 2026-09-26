import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_API_URL } from '@/lib/api/backend';
import { setAuthCookies } from '@/lib/api/proxy';
import { MOCK_AUTH_ENABLED, MOCK_ACCESS_TOKEN, MOCK_REFRESH_TOKEN, getMockUserByEmail } from '@/lib/api/mock-auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (MOCK_AUTH_ENABLED) {
      const mockUser = getMockUserByEmail(email || '');
      const resp = NextResponse.json({
        success: true,
        data: {
          user: {
            id: mockUser.id,
            email: mockUser.email,
            firstName: mockUser.firstName,
            lastName: mockUser.lastName,
            role: 'employee', // real role comes from /api/auth/me
            permissions: [],
            mustChangePassword: false,
          },
        },
      });
      setAuthCookies(resp, MOCK_ACCESS_TOKEN, MOCK_REFRESH_TOKEN);
      // Remembered so /api/auth/me returns the same per-role mock user.
      resp.cookies.set('mockUserEmail', mockUser.email, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });
      return resp;
    }

    const response = await fetch(`${BACKEND_API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    const resp = NextResponse.json({
      success: data.success,
      data: {
        user: {
          id: data.data.user.id,
          email: data.data.user.email,
          firstName: data.data.user.firstName,
          lastName: data.data.user.lastName,
          role: 'employee', // real role/permissions come from /api/auth/me
          permissions: [],
          // Forced temporary-password change gate (T06); real value comes
          // from /api/auth/me — this lets the login screen route correctly
          // even before that refresh lands.
          mustChangePassword: data.data.user.mustChangePassword ?? false,
        },
      },
    });

    // httpOnly cookies: access token (15m) + rotating refresh token (7d).
    setAuthCookies(resp, data.data.accessToken, data.data.refreshToken);

    return resp;
  } catch {
    return NextResponse.json(
      { success: false, error: { message: 'Login failed' } },
      { status: 500 }
    );
  }
}
