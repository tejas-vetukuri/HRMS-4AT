import { NextRequest, NextResponse } from 'next/server';
import { proxyToBackend, clearAuthCookies, setAuthCookies } from '@/lib/api/proxy';

export async function GET(req: NextRequest) {
  try {
    const qs = req.nextUrl.search;
    const { status, body, rotated, sessionExpired } = await proxyToBackend(
      req,
      `/employees/${qs}`
    );

    if (sessionExpired || status === 401) {
      const resp = NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      );
      clearAuthCookies(resp);
      return resp;
    }

    const resp = NextResponse.json(
      body ?? { success: false, error: { message: 'Failed to load employees' } },
      { status: status || 502 }
    );

    if (rotated) {
      setAuthCookies(resp, rotated.accessToken, rotated.refreshToken);
    }

    return resp;
  } catch (err) {
    console.error('[api/employees] failed:', err);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to load employees' } },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { status, body, rotated, sessionExpired } = await proxyToBackend(
      req,
      `/employees/bulk-upload/`,
      { isMultipart: true }
    );

    if (sessionExpired || status === 401) {
      const resp = NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      );
      clearAuthCookies(resp);
      return resp;
    }

    const resp = NextResponse.json(
      body ?? { success: false, error: { message: 'Failed to upload file' } },
      { status: status || 502 }
    );

    if (rotated) {
      setAuthCookies(resp, rotated.accessToken, rotated.refreshToken);
    }

    return resp;
  } catch (err) {
    console.error('[api/employees/bulk-upload] failed:', err);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to upload file' } },
      { status: 500 }
    );
  }
}
