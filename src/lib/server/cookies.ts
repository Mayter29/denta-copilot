import 'server-only';
import { cookies } from 'next/headers';
import { z } from 'zod';
import type { CookieStore } from './auth';

export const CONTEXT_COOKIE = 'denta-context';
const selectionSchema = z.object({ tenantId: z.uuid(), branchId: z.uuid() });
export type Selection = z.infer<typeof selectionSchema>;

/** Real writable cookie store for Route Handlers (Next allows writes there). */
export async function routeCookieStore(): Promise<CookieStore> {
  const jar = await cookies();
  return {
    get: (name) => jar.get(name)?.value,
    set: (name, value, maxAge) =>
      jar.set(name, value, { httpOnly: true, sameSite: 'strict', path: '/', maxAge }),
    clear: (name) => jar.delete(name),
  };
}

/**
 * Cookie store for Server Component rendering, where Next forbids writes.
 * Reads work; a refresh computed during render is returned to the caller for this
 * request, and the next Route Handler call persists it. Writes are attempted and
 * the render-phase rejection is ignored — never used to fake persistence.
 */
export async function renderCookieStore(): Promise<CookieStore> {
  const jar = await cookies();
  return {
    get: (name) => jar.get(name)?.value,
    set: (name, value, maxAge) => {
      try {
        jar.set(name, value, { httpOnly: true, sameSite: 'strict', path: '/', maxAge });
      } catch {
        // Render phase: persistence happens on the next handler request.
      }
    },
    clear: (name) => {
      try {
        jar.delete(name);
      } catch {
        // Render phase only.
      }
    },
  };
}

export function encodeSelection(selection: Selection): string {
  return Buffer.from(JSON.stringify(selection), 'utf8').toString('base64url');
}

export function decodeSelection(raw: string | undefined): Selection | null {
  if (!raw) return null;
  try {
    const parsed = selectionSchema.safeParse(JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
