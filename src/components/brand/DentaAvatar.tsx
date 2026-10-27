'use client';
import { useState } from 'react';
import { DentaMascot } from './DentaMascot';

export function DentaAvatar({ busy }: { busy: boolean }) {
  const [animated, setAnimated] = useState(true);
  return (
    <button
      type="button"
      className="copilot-avatar"
      aria-label="Animación de Denta"
      aria-pressed={animated}
      title={animated ? 'Pausar animación de Denta' : 'Reanudar animación de Denta'}
      onClick={() => setAnimated((value) => !value)}
    >
      <DentaMascot
        size={48}
        mood={busy ? 'pensando' : 'neutral'}
        animate={animated}
        blink={animated}
      />
    </button>
  );
}
