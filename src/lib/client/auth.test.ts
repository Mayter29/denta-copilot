import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchSession, login, logout, selectContext } from './auth';

afterEach(() => {
  vi.unstubAllGlobals();
});
const json = (body: unknown, ok = true) =>
  new Response(JSON.stringify(body), { status: ok ? 200 : 401 });

describe('cliente de autenticación', () => {
  it('propaga el rechazo al seleccionar una sede y rechaza UUIDs inválidos antes de enviar', async () => {
    const fetcher = vi.fn(async () => json({ error: 'Sin acceso a esa sede.' }, false));
    vi.stubGlobal('fetch', fetcher);
    await expect(selectContext({ tenantId: 'invalid', branchId: 'invalid' })).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
    await expect(
      selectContext({
        tenantId: '10000000-0000-4000-8000-000000000001',
        branchId: '20000000-0000-4000-8000-000000000001',
      }),
    ).rejects.toThrow('Sin acceso a esa sede.');
  });
  it('inicia sesión y devuelve solo el ID', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ userId: '00000000-0000-4000-8000-000000000001' })),
    );
    const result = await login('recepcion@brisa.demo', 'clave');
    expect(result.userId).toBe('00000000-0000-4000-8000-000000000001');
    const [, init] = (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(JSON.parse(init.body as string)).toEqual({
      email: 'recepcion@brisa.demo',
      password: 'clave',
    });
  });
  it('propaga el error del servidor sin exponer la respuesta cruda', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ error: 'Credenciales inválidas.' }, false)),
    );
    await expect(login('a@b.c', 'x')).rejects.toThrow('Credenciales inválidas.');
  });
  it('lee la sesión con contextos y cierra sesión', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        String(url).endsWith('/session')
          ? json({
              authenticated: true,
              userId: '00000000-0000-4000-8000-000000000001',
              contexts: [],
              serviceWrites: false,
              patient: { available: false, reason: 'Sin vínculo verificado.' },
            })
          : json({ ok: true }),
      ),
    );
    const session = await fetchSession();
    expect(session).toEqual({
      authenticated: true,
      userId: '00000000-0000-4000-8000-000000000001',
      contexts: [],
      serviceWrites: false,
      patient: { available: false, reason: 'Sin vínculo verificado.' },
    });
    await logout();
  });
  it('rechaza una sesión con forma inválida', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ authenticated: true })),
    );
    await expect(fetchSession()).rejects.toThrow('inválida');
  });
});
