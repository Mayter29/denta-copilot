import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { getSupabaseConfig } from '../supabase/config';
import { RequestError } from './workspace';

export const AUTH_COOKIE = 'denta-auth';
const credentialsSchema = z.object({
  email: z.string().trim().min(3).max(320),
  password: z.string().min(1).max(512),
});
const sessionPayloadSchema = z.object({
  uid: z.string().uuid(),
  at: z.string().min(10),
  rt: z.string().min(10),
  exp: z.number().int().positive(),
});
export type AuthSession = { userId: string; accessToken: string };

// Minimal cookie store so routes can adapt next/headers and tests can use memory.
export type CookieStore = {
  get: (name: string) => string | undefined;
  set: (name: string, value: string, maxAge: number) => void;
  clear: (name: string) => void;
};

function secret() {
  const value = process.env.DEMO_SESSION_SECRET;
  if (!value || value.length < 32)
    throw new RequestError('Configurá DEMO_SESSION_SECRET con al menos 32 caracteres.', 503);
  return value;
}

function sign(payload: string) {
  return createHmac('sha256', secret()).update(payload).digest('hex');
}

export function encodeAuthSession(session: z.infer<typeof sessionPayloadSchema>) {
  const payload = Buffer.from(JSON.stringify(session), 'utf8').toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function decodeAuthSession(token: string | undefined) {
  if (!token) return null;
  const [payload, mac] = token.split('.');
  if (!payload || !mac || mac.length !== 64) return null;
  const expected = sign(payload);
  if (
    mac.length !== expected.length ||
    !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))
  )
    return null;
  try {
    const parsed = sessionPayloadSchema.safeParse(
      JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')),
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export type SupabaseFactory = () => SupabaseClient;

export function appSupabase(): SupabaseClient {
  const { url, publishableKey } = getSupabaseConfig();
  return createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init) =>
        fetch(input, { ...init, cache: 'no-store', signal: AbortSignal.timeout(10_000) }),
    },
  });
}

/** Executes password login server-side. Tokens stay in the signed cookie, never in the body. */
export async function loginWithPassword(
  store: CookieStore,
  input: unknown,
  factory: SupabaseFactory = appSupabase,
) {
  const parsed = credentialsSchema.safeParse(input);
  if (!parsed.success) throw new RequestError('Ingresá correo y contraseña.', 400);
  const client = factory();
  const { data, error } = await client.auth.signInWithPassword(parsed.data);
  if (error || !data.session || !data.user) throw new RequestError('Credenciales inválidas.', 401);
  const exp = Math.floor(Date.now() / 1000) + (data.session.expires_in ?? 3600);
  store.set(
    AUTH_COOKIE,
    encodeAuthSession({ uid: data.user.id, at: data.session.access_token, rt: data.session.refresh_token, exp }),
    Math.max(0, exp - Math.floor(Date.now() / 1000)),
  );
  return { userId: data.user.id };
}

/** Verifies the session cookie against Supabase. Actor identity comes only from here. */
export async function authSession(
  store: CookieStore,
  factory: SupabaseFactory = appSupabase,
): Promise<AuthSession | null> {
  const session = decodeAuthSession(store.get(AUTH_COOKIE));
  if (!session) return null;
  const client = factory();
  if (session.exp - Math.floor(Date.now() / 1000) > 60) {
    const { data, error } = await client.auth.getUser(session.at);
    if (!error && data.user && data.user.id === session.uid)
      return { userId: session.uid, accessToken: session.at };
    store.clear(AUTH_COOKIE);
    return null;
  }
  const { data, error } = await client.auth.refreshSession({ refresh_token: session.rt });
  if (error || !data.session || !data.user || data.user.id !== session.uid) {
    store.clear(AUTH_COOKIE);
    return null;
  }
  const exp = Math.floor(Date.now() / 1000) + (data.session.expires_in ?? 3600);
  store.set(
    AUTH_COOKIE,
    encodeAuthSession({ uid: data.user.id, at: data.session.access_token, rt: data.session.refresh_token, exp }),
    Math.max(0, exp - Math.floor(Date.now() / 1000)),
  );
  return { userId: data.user.id, accessToken: data.session.access_token };
}

export async function requireAuthSession(
  store: CookieStore,
  factory?: SupabaseFactory,
): Promise<AuthSession> {
  const session = await authSession(store, factory);
  if (!session) throw new RequestError('Sesión vencida. Volvé a ingresar.', 401);
  return session;
}

export function logoutSession(store: CookieStore) {
  store.clear(AUTH_COOKIE);
}

/** User-scoped client: reads apply RLS for the verified token. Never used for RPC writes. */
export function userSupabase(accessToken: string): SupabaseClient {
  const { url, publishableKey } = getSupabaseConfig();
  return createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
      fetch: (input, init) =>
        fetch(input, { ...init, cache: 'no-store', signal: AbortSignal.timeout(10_000) }),
    },
  });
}
