import { NextRequest, NextResponse } from 'next/server';
import { createBackendProxyRoute } from '@/lib/api/proxy';

/**
 * Proxy for the access-control admin screens. Only these backend resources are
 * reachable through it; everything else 404s here, so this route can't be used
 * to call arbitrary backend endpoints. The backend enforces the real
 * permission checks (roles.manage / audit.read) on every one of them.
 */
const ALLOWED_RESOURCES = new Set([
  'roles',
  'permissions',
  'role-permissions',
  'users',
  'user-permission-overrides',
  'audit-log',
]);

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
type Ctx = { params: Promise<{ path?: string[] }> };

function handler(method: Method) {
  return async (req: NextRequest, ctx: Ctx): Promise<NextResponse> => {
    const { path = [] } = await ctx.params;
    const [resource, ...rest] = path;

    // `users/me...` belongs to the signed-in user's own routes, not admin.
    if (!resource || !ALLOWED_RESOURCES.has(resource) || (resource === 'users' && rest[0] === 'me')) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Not found', fields: {} } },
        { status: 404 },
      );
    }

    // The backend's routes end with a slash (e.g. /roles/5/); the trailing ''
    // segment produces it.
    return createBackendProxyRoute(resource)[method](req, {
      params: Promise.resolve({ path: [...rest, ''] }),
    });
  };
}

export const GET = handler('GET');
export const POST = handler('POST');
export const PATCH = handler('PATCH');
export const PUT = handler('PUT');
export const DELETE = handler('DELETE');
