import { useId } from 'react';
import { LogOut } from 'lucide-react';
import type { OrgContext } from '@/lib/domain/org-context';

type Props = {
  contexts: OrgContext[];
  selection: OrgContext | null;
  pending: 'branch' | 'logout' | null;
  error: string;
  onBranch: (value: string) => void;
  onLogout: () => void;
};

/** Shared session controls stay reachable in desktop and compact navigation. */
export function SessionControls({
  contexts,
  selection,
  pending,
  error,
  onBranch,
  onLogout,
}: Props) {
  const id = useId();
  return (
    <div className="auth-panel" aria-label="Sesión de secretaría" aria-busy={pending !== null}>
      <strong>Sesión verificada</strong>
      {contexts.length > 0 ? (
        <label htmlFor={id}>
          <span className="sr-only">Sede activa</span>
          <select
            id={id}
            value={selection ? `${selection.tenantId}/${selection.branchId}` : ''}
            disabled={pending !== null || (contexts.length < 2 && selection !== null)}
            onChange={(event) => onBranch(event.target.value)}
          >
            {!selection ? (
              <option value="" disabled>
                Seleccioná una sede
              </option>
            ) : null}
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
      <button type="button" className="secondary" disabled={pending !== null} onClick={onLogout}>
        <LogOut size={15} />
        {pending === 'logout' ? 'Cerrando sesión…' : 'Cerrar sesión'}
      </button>
      {pending === 'branch' ? <p role="status">Cambiando sede…</p> : null}
      {error ? (
        <p role="alert" className="auth-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
