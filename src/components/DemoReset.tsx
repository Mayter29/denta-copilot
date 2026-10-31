'use client';
import { useState } from 'react';
import { RotateCcw } from 'lucide-react';

/**
 * Two-step reset of the local demo session back to its fictitious seed.
 * Only touches this browser's session file; never connected data.
 */
export function DemoReset({ disabled, onReset }: { disabled?: boolean; onReset: () => Promise<void> }) {
  const [asking, setAsking] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function reset() {
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/workspace', { method: 'DELETE' });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        throw new Error(
          body && typeof body === 'object' && 'error' in body ? String((body as { error: unknown }).error) : '',
        );
      }
      await onReset();
      setAsking(false);
    } catch (e) {
      setError((e as Error).message || 'No se pudo reiniciar la demo.');
    } finally {
      setPending(false);
    }
  }

  if (!asking)
    return (
      <button type="button" className="demo-reset" disabled={disabled} onClick={() => setAsking(true)}>
        <RotateCcw size={14} aria-hidden="true" />
        Reiniciar demo
      </button>
    );
  return (
    <div className="demo-reset-confirm" role="group" aria-label="Confirmar reinicio de la demo">
      <p>Se borran la conversación y los cambios de esta sesión ficticia.</p>
      <div>
        <button type="button" className="primary" disabled={pending} onClick={() => void reset()}>
          {pending ? 'Reiniciando…' : 'Reiniciar'}
        </button>
        <button type="button" className="secondary" disabled={pending} onClick={() => setAsking(false)}>
          Cancelar
        </button>
      </div>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
