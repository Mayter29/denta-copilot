import { expect, it } from 'vitest';
import { getSupabaseConfig, SUPABASE_PROJECT_URL } from './config';
const key = 'sb_publishable_fictional_test_value';
it('acepta el proyecto seleccionado y una clave publicable', () => {
  expect(
    getSupabaseConfig({
      NEXT_PUBLIC_SUPABASE_URL: SUPABASE_PROJECT_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
    }).url,
  ).toBe(SUPABASE_PROJECT_URL);
});
it.each([
  'https://otro-proyecto.supabase.co',
  'https://lyphdzeazqnaepyzzisi.supabase.co.evil.example',
  'http://lyphdzeazqnaepyzzisi.supabase.co',
  undefined,
])('rechaza cualquier otro destino antes de realizar una solicitud: %s', (url) => {
  expect(() =>
    getSupabaseConfig({ NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key }),
  ).toThrow('exclusivamente');
});
it.each(['sb_secret_fictional_value', 'service_role', '', undefined])(
  'rechaza claves secretas o sin configurar',
  (publishableKey) => {
    expect(() =>
      getSupabaseConfig({
        NEXT_PUBLIC_SUPABASE_URL: SUPABASE_PROJECT_URL,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
      }),
    ).toThrow('publicable');
  },
);
