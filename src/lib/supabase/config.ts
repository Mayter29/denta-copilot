// Explicit project chosen by the owner. Changing environments must be deliberate.
export const SUPABASE_PROJECT_REF = 'lyphdzeazqnaepyzzisi';
export const SUPABASE_PROJECT_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co`;

export function getSupabaseConfig(env: Record<string, string | undefined> = process.env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (url !== SUPABASE_PROJECT_URL) {
    throw new Error(`Supabase debe apuntar exclusivamente al proyecto ${SUPABASE_PROJECT_REF}.`);
  }
  if (!publishableKey?.startsWith('sb_publishable_') || publishableKey.length < 25) {
    throw new Error(
      'Configurá la clave publicable de Denta Copilot; no se aceptan claves secretas.',
    );
  }
  return { url, publishableKey };
}
