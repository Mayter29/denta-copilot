'use client';
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/components/app/AppShell';

export default function SelectBranchPage() {
  const { contexts, serviceWrites } = useAppContext();
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const choose = useCallback(
    async (tenantId: string, branchId: string) => {
      setPending(true);
      setError('');
      try {
        const response = await fetch('/api/auth/context', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId, branchId }),
        });
        if (!response.ok) {
          const data: unknown = await response.json().catch(() => null);
          const message =
            data && typeof data === 'object' && 'error' in data
              ? String((data as { error: unknown }).error)
              : 'No se pudo seleccionar la sede.';
          throw new Error(message);
        }
        router.push('/app/copiloto');
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
        setPending(false);
      }
    },
    [router],
  );
  // Sin autoselección por efecto: la persona confirma su sede con un clic.

  return (
    <section className="select-branch">
      <h1>Seleccioná tu sede</h1>
      <p className="muted">Tu identidad está verificada. Elegí la sede para operar.</p>
      {!serviceWrites ? (
        <div className="error-message" role="alert">
          Configuración de escritura no disponible en el servidor. No se activó ninguna agenda local.
        </div>
      ) : null}
      {error ? <div className="error-message" role="alert">{error}</div> : null}
      <div className="branch-list">
        {contexts.map((context) => (
          <button
            key={`${context.tenantId}/${context.branchId}`}
            type="button"
            disabled={pending || !serviceWrites}
            onClick={() => void choose(context.tenantId, context.branchId)}
          >
            <strong>{context.tenantName}</strong>
            <span>{context.branchName} · {context.role}</span>
          </button>
        ))}
      </div>
      {!contexts.length ? <p role="status">Sin sedes asignadas. Pedí acceso a tu organización.</p> : null}
    </section>
  );
}
