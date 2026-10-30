'use client';
import { createContext, useCallback, useContext, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { CalendarDays, Layers2, LogOut, MessageSquare } from 'lucide-react';
import type { OrgContext } from '@/lib/domain/org-context';
import { DentaryBrand } from '../brand/DentaryBrand';

export type AppContextValue = {
  userId: string;
  contexts: OrgContext[];
  selection: OrgContext | null;
  serviceWrites: boolean;
};
const AppContext = createContext<AppContextValue | null>(null);

export function useAppContext(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useAppContext fuera del shell de la aplicación.');
  return value;
}

const NAV = [
  { href: '/app/copiloto', label: 'Copiloto', icon: MessageSquare },
  { href: '/app/agenda', label: 'Agenda', icon: CalendarDays },
  { href: '/app/conocimiento', label: 'Conocimiento', icon: Layers2 },
];

export function AppShell({
  userId,
  contexts,
  selection,
  serviceWrites,
  children,
}: AppContextValue & { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const switchBranch = useCallback(
    async (value: string) => {
      const [tenantId, branchId] = value.split('/');
      if (!tenantId || !branchId) return;
      const response = await fetch('/api/auth/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, branchId }),
      });
      if (response.ok) router.refresh();
    },
    [router],
  );
  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    try {
      for (const key of Object.keys(window.localStorage)) {
        if (key.startsWith('denta-')) window.localStorage.removeItem(key);
      }
    } catch {
      // Best effort; the session cookie is already cleared server-side.
    }
    router.push('/login');
    router.refresh();
  }, [router]);

  return (
    <AppContext.Provider value={{ userId, contexts, selection, serviceWrites }}>
      <div className="app-shell context-hidden">
        <nav className="sidebar" aria-label="Navegación principal">
          <DentaryBrand placement="sidebar" />
          <div className="workspace-switch">
            <div className="clinic-avatar">{selection ? selection.tenantName.slice(0, 1) : '?'}</div>
            <div>
              <strong>{selection?.tenantName ?? 'Sin organización'}</strong>
              <span>{selection?.branchName ?? 'Seleccioná una sede'}</span>
            </div>
          </div>
          <span className="nav-label">ESPACIO DE TRABAJO</span>
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`nav-item${pathname === href ? ' active' : ''}`}
              aria-current={pathname === href ? 'page' : undefined}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
          <div className="sidebar-bottom">
            <div className="auth-panel" aria-label="Sesión de secretaría">
              <strong>Sesión verificada</strong>
              {contexts.length > 0 ? (
                <label>
                  <span className="sr-only">Sede activa</span>
                  <select
                    value={selection ? `${selection.tenantId}/${selection.branchId}` : ''}
                    disabled={contexts.length < 2}
                    onChange={(event) => void switchBranch(event.target.value)}
                  >
                    {contexts.map((context) => (
                      <option
                        key={`${context.tenantId}/${context.branchId}`}
                        value={`${context.tenantId}/${context.branchId}`}
                      >
                        {context.tenantName} · {context.branchName} ({context.role})
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <p className="auth-error" role="status">
                  Sin sedes asignadas. Pedí acceso a tu organización.
                </p>
              )}
              <button type="button" className="secondary" onClick={() => void logout()}>
                <LogOut size={15} />
                Cerrar sesión
              </button>
            </div>
            <div className="user-profile">
              <div className="user-avatar">M</div>
              <div>
                <strong>Secretaría</strong>
                <span>Datos ficticios de demostración</span>
              </div>
            </div>
          </div>
        </nav>
        <main className="main app-main">{children}</main>
      </div>
    </AppContext.Provider>
  );
}
