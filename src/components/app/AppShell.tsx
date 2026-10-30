'use client';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { CalendarDays, Layers2, Menu, MessageSquare } from 'lucide-react';
import type { OrgContext } from '@/lib/domain/org-context';
import { logout as logoutRemote, selectContext } from '@/lib/client/auth';
import { DentaryBrand } from '../brand/DentaryBrand';
import { SessionControls } from './SessionControls';

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
  const [pending, setPending] = useState<'branch' | 'logout' | null>(null);
  const [error, setError] = useState('');
  const actionInFlight = useRef(false);
  const switchBranch = useCallback(
    async (value: string) => {
      if (actionInFlight.current) return;
      const [tenantId, branchId] = value.split('/');
      if (!contexts.some((c) => c.tenantId === tenantId && c.branchId === branchId)) return;
      actionInFlight.current = true;
      setPending('branch');
      setError('');
      try {
        await selectContext({ tenantId, branchId });
        router.refresh();
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : 'No se pudo cambiar de sede.');
      } finally {
        actionInFlight.current = false;
        setPending(null);
      }
    },
    [contexts, router],
  );
  const logout = useCallback(async () => {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setPending('logout');
    setError('');
    try {
      await logoutRemote();
      try {
        for (const key of Object.keys(window.localStorage)) {
          if (
            key.startsWith(`denta-draft-${userId}-`) ||
            key.startsWith(`denta-conversation-${userId}-`)
          )
            window.localStorage.removeItem(key);
        }
      } catch {
        // Local preferences are best-effort; the server confirmed cookie removal.
      }
      router.replace('/login');
      router.refresh();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'No se pudo cerrar la sesión. Reintentá.',
      );
    } finally {
      actionInFlight.current = false;
      setPending(null);
    }
  }, [router, userId]);

  const sessionControls = (
    <SessionControls
      contexts={contexts}
      selection={selection}
      pending={pending}
      error={error}
      onBranch={(value) => void switchBranch(value)}
      onLogout={() => void logout()}
    />
  );

  const contextValue = useMemo(
    () => ({ userId, contexts, selection, serviceWrites }),
    [userId, contexts, selection, serviceWrites],
  );
  return (
    <AppContext.Provider value={contextValue}>
      <div className="app-shell context-hidden">
        <nav className="sidebar" aria-label="Navegación principal">
          <DentaryBrand placement="sidebar" />
          <div className="workspace-switch">
            <div className="clinic-avatar">
              {selection ? selection.tenantName.slice(0, 1) : '?'}
            </div>
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
            {sessionControls}
            <div className="user-profile">
              <div className="user-avatar">M</div>
              <div>
                <strong>Secretaría</strong>
                <span>Datos ficticios de demostración</span>
              </div>
            </div>
          </div>
        </nav>
        <main className="main app-main">
          <header className="workspace-mobile-header">
            <DentaryBrand placement="header" />
            <details key={pathname} className="workspace-mobile-menu">
              <summary>
                <Menu size={20} />
                <span>Menú</span>
              </summary>
              <div className="workspace-mobile-menu-panel">
                <nav aria-label="Navegación móvil">
                  {NAV.map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className="mobile-nav-link"
                      aria-current={pathname === href ? 'page' : undefined}
                    >
                      <Icon size={18} />
                      {label}
                    </Link>
                  ))}
                </nav>
                {sessionControls}
              </div>
            </details>
          </header>
          {children}
        </main>
      </div>
    </AppContext.Provider>
  );
}
