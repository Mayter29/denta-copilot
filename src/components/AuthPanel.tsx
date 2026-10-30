'use client';
import { useState } from 'react';
import { LogIn, LogOut } from 'lucide-react';
import { fetchSession, login, logout, type AuthSessionState, type OrgSelection } from '@/lib/client/auth';

type Props = {
  auth: AuthSessionState | null;
  selection: OrgSelection | null;
  onAuthChange: (auth: AuthSessionState, selection: OrgSelection | null) => void;
};

export function AuthPanel({ auth, selection, onAuthChange }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending || !email.trim() || !password) return;
    setPending(true);
    setError('');
    try {
      await login(email.trim(), password);
      const next = await fetchSession();
      onAuthChange(next, next.authenticated && next.contexts.length > 0
        ? { tenantId: next.contexts[0].tenantId, branchId: next.contexts[0].branchId }
        : null);
      setEmail('');
      setPassword('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function exit() {
    setPending(true);
    try {
      await logout();
      onAuthChange({ authenticated: false }, null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  if (!auth || !auth.authenticated) {
    return (
      <form className="auth-panel" onSubmit={(e) => void submit(e)} aria-label="Ingreso de secretaría">
        <strong>Secretaría conectada</strong>
        <p className="muted small">Ingresá para operar la agenda de tu sede.</p>
        <label className="sr-only" htmlFor="auth-email">Correo</label>
        <input
          id="auth-email"
          type="email"
          autoComplete="username"
          placeholder="Correo"
          value={email}
          disabled={pending}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label className="sr-only" htmlFor="auth-password">Contraseña</label>
        <input
          id="auth-password"
          type="password"
          autoComplete="current-password"
          placeholder="Contraseña"
          value={password}
          disabled={pending}
          onChange={(e) => setPassword(e.target.value)}
        />
      {error ? <p role="alert" className="auth-error">{error}</p> : null}
      <button type="submit" className="primary" disabled={pending || !email.trim() || !password}>
        <LogIn size={15} />
        {pending ? 'Verificando…' : 'Ingresar'}
      </button>
      <p className="muted small">
        Acceso solo para secretaría. ¿Sos paciente? Tus citas las gestiona recepción.
      </p>
      </form>
    );
  }
  const current = auth.contexts.find(
    (c) => c.tenantId === selection?.tenantId && c.branchId === selection?.branchId,
  );
  return (
    <div className="auth-panel" aria-label="Sesión de secretaría">
      <strong>Sesión verificada</strong>
      <p className="muted small">Secretaría con acceso a {auth.contexts.length} sede(s).</p>
      {auth.contexts.length > 0 ? (
        <label>
          <span className="sr-only">Sede activa</span>
          <select
            value={current ? `${current.tenantId}/${current.branchId}` : ''}
            disabled={pending || auth.contexts.length < 2}
            onChange={(e) => {
              const found = auth.contexts.find((c) => `${c.tenantId}/${c.branchId}` === e.target.value);
              if (found) onAuthChange(auth, { tenantId: found.tenantId, branchId: found.branchId });
            }}
          >
            {auth.contexts.map((c) => (
              <option key={`${c.tenantId}/${c.branchId}`} value={`${c.tenantId}/${c.branchId}`}>
                {c.tenantName} · {c.branchName} ({c.role})
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p role="status" className="auth-error">
          Sin sedes asignadas. Pedí acceso a tu organización.
        </p>
      )}
      {!auth.serviceWrites ? (
        <p className="muted small">Escritura remota no configurada: la demo local sigue activa.</p>
      ) : null}
      <button type="button" className="secondary" disabled={pending} onClick={() => void exit()}>
        <LogOut size={15} />
        Cerrar sesión
      </button>
      {error ? <p role="alert" className="auth-error">{error}</p> : null}
    </div>
  );
}
