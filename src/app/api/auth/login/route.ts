import { cookies } from 'next/headers';
import { loginWithPassword, type CookieStore } from '@/lib/server/auth';
import { apiError, boundedJson, guardLocal } from '@/lib/server/workspace';
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
    const result = await loginWithPassword(store, await boundedJson(request));
    return Response.json(result);
  } catch (error) {
    return apiError(error);
  }
}
