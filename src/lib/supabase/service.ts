import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './config';

// Separate, server-only configuration for privileged RPC calls.
// The publishable key in getSupabaseConfig can never authorize these functions:
// every public RPC revokes execute from anon/authenticated and grants it only to service_role.
export class ServiceWritesUnavailable extends Error {
  constructor() {
    super('Persistencia remota no configurada en este entorno.');
  }
}

export function isServiceWritesConfigured(env: Record<string, string | undefined> = process.env) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';
  if (key.length < 25) return false;
  if (key.startsWith('sb_publishable_') || key.startsWith('sb_public_')) return false;
  try {
    getSupabaseConfig(env);
    return true;
  } catch {
    return false;
  }
}

export function createServiceClient(
  env: Record<string, string | undefined> = process.env,
): SupabaseClient {
  if (!isServiceWritesConfigured(env)) throw new ServiceWritesUnavailable();
  const { url } = getSupabaseConfig(env);
  const key = env.SUPABASE_SERVICE_ROLE_KEY!.trim();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init) =>
        fetch(input, { ...init, cache: 'no-store', signal: AbortSignal.timeout(15_000) }),
    },
  });
}
