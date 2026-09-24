import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_API_URL } from '@/lib/api/backend';
import { setAuthCookies } from '@/lib/api/proxy';
import { MOCK_AUTH_ENABLED, MOCK_ACCESS_TOKEN, MOCK_REFRESH_TOKEN, getMockUserByEmail } from '@/lib/api/mock-auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (MOCK_AUTH_ENABLED) {
      const mockUser = getMockUserByEmail(email);
      const resp = NextResponse.json({
        success: true,
        data: {
          user: {
            id: mockUser.id,
            email: mockUser.email,
            firstName: mockUser.firstName,
            lastName: mockUser.lastName,
            roles: mockUser.roles,
            permissions: mockUser.permissions,
          },
        },
      });
      setAuthCookies(resp, MOCK_ACCESS_TOKEN, MOCK_REFRESH_TOKEN);
      // Store the mock user email for later retrieval in /api/auth/me
      resp.cookies.set('mockUserEmail', mockUser.email, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });
      return resp;
    }

    console.log('[auth/login] Calling backend:', `${BACKEND_API_URL}/auth/login`);

    const response = await fetch(`${BACKEND_API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    console.log('[auth/login] Backend response status:', response.status);

    const data = await response.json();

    console.log('[auth/login] Backend response data:', data);

    if (!response.ok) {
      console.log('[auth/login] Backend error response');
      return NextResponse.json(data, { status: response.status });
    }

    // Ensure role is included in response for frontend
    if (data.data.user && !data.data.user.role && data.data.user.firstName) {
      // Fallback: if role not in response, query /users/me (shouldn't be needed)
      console.log('[auth/login] Warning: role not in login response');
    }

    // Pass through backend response directly
    const resp = NextResponse.json(data);

    // httpOnly cookies: access token (15m) + rotating refresh token (7d).
    setAuthCookies(resp, data.data.accessToken, data.data.refreshToken);

    console.log('[auth/login] Login successful');
    return resp;
  } catch (err) {
    console.error('[auth/login] Error:', err);
    return NextResponse.json(
      { success: false, error: { message: 'Login failed', details: String(err) } },
      { status: 500 }
    );
  }
}
