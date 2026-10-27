import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './config';

// Anonymous, non-privileged server client for the initial connection check.
// Add a request-scoped SSR client when Supabase Auth is implemented.
export function createSupabaseServerClient() {
  const { url, publishableKey } = getSupabaseConfig();
  return createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init) =>
        fetch(input, { ...init, cache: 'no-store', signal: AbortSignal.timeout(10_000) }),
    },
  });
}

export async function checkSupabaseConnection() {
  const { url, publishableKey } = getSupabaseConfig();
  // The metadata root of PostgREST requires a secret key on this project.
  // Auth settings is a read-only endpoint that accepts the public app key.
  const response = await fetch(`${url}/auth/v1/settings`, {
    headers: { apikey: publishableKey },
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return false;
  const settings: unknown = await response.json();
  return !!settings && typeof settings === 'object' && 'external' in settings;
}
