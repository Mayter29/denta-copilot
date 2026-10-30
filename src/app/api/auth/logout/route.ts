import { cookies } from 'next/headers';
import { logoutSession, type CookieStore } from '@/lib/server/auth';
import { apiError, guardLocal } from '@/lib/server/workspace';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    guardLocal(request, true);
    const jar = await cookies();
    const store: CookieStore = {
      get: (name) => jar.get(name)?.value,
      set: (name, value, maxAge) =>
        jar.set(name, value, { httpOnly: true, sameSite: 'strict', path: '/', maxAge }),
      clear: (name) => jar.delete(name),
    };
    logoutSession(store);
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
