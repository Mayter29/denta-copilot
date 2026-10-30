import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  authSession,
  decodeAuthSession,
  encodeAuthSession,
  loginWithPassword,
  logoutSession,
  requireAuthSession,
  type CookieStore,
} from './auth';

const supabase = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  getUser: vi.fn(),
  refreshSession: vi.fn(),
}));
const factory = () => ({ auth: supabase }) as never;

function cookieStore(): CookieStore & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    get: (name) => values.get(name),
    set: (name, value) => void values.set(name, value),
    clear: (name) => void values.delete(name),
  };
}

beforeEach(() => {
  vi.stubEnv('DEMO_SESSION_SECRET', 'x'.repeat(40));
  vi.clearAllMocks();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('sesión de servidor con Supabase Auth', () => {
  it('login guarda la sesión firmada y devuelve solo el ID', async () => {
    supabase.signInWithPassword.mockResolvedValue({
      data: {
        user: { id: '00000000-0000-4000-8000-000000000001' },
        session: { access_token: 'access-token-value', refresh_token: 'refresh-token-value', expires_in: 3600 },
      },
      error: null,
    });
    const store = cookieStore();
    const result = await loginWithPassword(
      store,
      { email: 'recepcion@brisa.demo', password: 'clave-ficticia' },
      factory,
    );
    expect(result).toEqual({ userId: '00000000-0000-4000-8000-000000000001' });
    const raw = store.values.get('denta-auth');
    expect(raw).toBeTruthy();
    expect(raw).not.toContain('access-token-value');
    expect(decodeAuthSession(raw)?.uid).toBe('00000000-0000-4000-8000-000000000001');
    expect(supabase.signInWithPassword).toHaveBeenCalledWith({
      email: 'recepcion@brisa.demo',
      password: 'clave-ficticia',
    });
  });
  it('rechaza credenciales inválidas y entradas malformadas sin crear sesión', async () => {
    supabase.signInWithPassword.mockResolvedValue({ data: {}, error: { message: 'Invalid' } });
    const store = cookieStore();
    await expect(loginWithPassword(store, { email: 'a@b.c', password: 'x' }, factory)).rejects.toThrow(
      'Credenciales',
    );
    expect(store.values.has('denta-auth')).toBe(false);
    await expect(loginWithPassword(store, { email: '', password: '' }, factory)).rejects.toThrow();
    expect(supabase.signInWithPassword).toHaveBeenCalledTimes(1);
  });
  it('verifica la sesión contra Supabase y exige el mismo usuario', async () => {
    const store = cookieStore();
    store.set(
      'denta-auth',
      encodeAuthSession({
        uid: '00000000-0000-4000-8000-000000000001',
        at: 'valid-access-token',
        rt: 'refresh-token-value',
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
      3600,
    );
    supabase.getUser.mockResolvedValue({
      data: { user: { id: '00000000-0000-4000-8000-000000000001' } },
      error: null,
    });
    const session = await authSession(store, factory);
    expect(session).toEqual({ userId: '00000000-0000-4000-8000-000000000001', accessToken: 'valid-access-token' });
    expect(supabase.getUser).toHaveBeenCalledWith('valid-access-token');
  });
  it('un token manipulado o de otro usuario cierra la sesión', async () => {
    const store = cookieStore();
    store.set('denta-auth', 'manipulado.firmafalsa', 3600);
    expect(await authSession(store, factory)).toBeNull();
    store.set(
      'denta-auth',
      encodeAuthSession({ uid: '00000000-0000-4000-8000-000000000001', at: 'x'.repeat(20), rt: 'y'.repeat(20), exp: Math.floor(Date.now() / 1000) + 3600 }),
      3600,
    );
    supabase.getUser.mockResolvedValue({
      data: { user: { id: '00000000-0000-4000-8000-000000000099' } },
      error: null,
    });
    expect(await authSession(store, factory)).toBeNull();
    expect(store.values.has('denta-auth')).toBe(false);
    await expect(requireAuthSession(store, factory)).rejects.toThrow('Sesión vencida');
  });
  it('renueva la sesión próxima a vencer y limpia al fallar', async () => {
    const store = cookieStore();
    store.set(
      'denta-auth',
      encodeAuthSession({ uid: '00000000-0000-4000-8000-000000000001', at: 'x'.repeat(20), rt: 'old-refresh', exp: Math.floor(Date.now() / 1000) + 10 }),
      10,
    );
    supabase.refreshSession.mockResolvedValue({
      data: {
        user: { id: '00000000-0000-4000-8000-000000000001' },
        session: { access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600 },
      },
      error: null,
    });
    const session = await authSession(store, factory);
    expect(session?.accessToken).toBe('new-access');
    supabase.refreshSession.mockResolvedValue({ data: {}, error: { message: 'expired' } });
    store.set(
      'denta-auth',
      encodeAuthSession({ uid: '00000000-0000-4000-8000-000000000001', at: 'x'.repeat(20), rt: 'old-refresh', exp: Math.floor(Date.now() / 1000) + 10 }),
      10,
    );
    expect(await authSession(store, factory)).toBeNull();
    expect(store.values.has('denta-auth')).toBe(false);
  });
  it('logout limpia la cookie de sesión', () => {
    const store = cookieStore();
    store.set('denta-auth', 'valor', 10);
    logoutSession(store);
    expect(store.values.has('denta-auth')).toBe(false);
  });
});
