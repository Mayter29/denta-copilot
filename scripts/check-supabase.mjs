import { getSupabaseConfig, SUPABASE_PROJECT_REF } from '../src/lib/supabase/config.ts';

try {
  process.loadEnvFile('.env.local');
  const { url, publishableKey } = getSupabaseConfig();
  const response = await fetch(`${url}/auth/v1/settings`, {
    headers: { apikey: publishableKey },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error('La API Auth no aceptó la conexión. Revisá URL y clave.');
  const settings = await response.json();
  if (!settings || typeof settings !== 'object' || !('external' in settings)) {
    throw new Error('La respuesta de Supabase no coincide con el servicio esperado.');
  }
  console.log(`Supabase conectado y verificado: ${SUPABASE_PROJECT_REF}`);
  console.log(
    'API Auth respondió con la clave publicable. La agenda aún usa almacenamiento local.',
  );
} catch (error) {
  // Never print SDK errors, response bodies or credentials.
  console.error(error instanceof Error ? error.message : 'No se pudo verificar Supabase.');
  process.exitCode = 1;
}
