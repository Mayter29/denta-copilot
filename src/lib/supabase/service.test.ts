import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServiceClient, isServiceWritesConfigured, ServiceWritesUnavailable } from './service';

const base = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://lyphdzeazqnaepyzzisi.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_valor-ficticio-1234567890',
};
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('configuración privilegiada de Supabase', () => {
  it('rechaza la clave publicable como credencial de escritura', () => {
    expect(
      isServiceWritesConfigured({ ...base, SUPABASE_SERVICE_ROLE_KEY: base.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }),
    ).toBe(false);
    expect(isServiceWritesConfigured(base)).toBe(false);
  });
  it('rechaza otro proyecto aunque la clave parezca válida', () => {
    expect(
      isServiceWritesConfigured({
        NEXT_PUBLIC_SUPABASE_URL: 'https://otro-proyecto.supabase.co',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: base.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_valor-ficticio-1234567890',
      }),
    ).toBe(false);
  });
  it('acepta la configuración exclusivamente para el proyecto permitido', () => {
    expect(
      isServiceWritesConfigured({ ...base, SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_valor-ficticio-1234567890' }),
    ).toBe(true);
  });
  it('exige la credencial antes de crear el cliente privilegiado', () => {
    expect(() => createServiceClient(base)).toThrow(ServiceWritesUnavailable);
  });
});
