'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { DentaMascot, type DentaMood } from './DentaMascot';

export type DentaPresence = 'reposo' | 'escucha' | 'transcribe' | 'consulta' | 'exito';
const MOOD: Record<DentaPresence, DentaMood> = {
  reposo: 'neutral',
  escucha: 'sorprendido',
  transcribe: 'pensando',
  consulta: 'pensando',
  exito: 'feliz',
};

/** Avatar state coordinator: presence from real chat/dictation activity, ambient motion with offscreen pause. */
export function DentaAvatar({
  busy,
  presence = 'reposo',
  level = 0,
}: {
  busy: boolean;
  presence?: DentaPresence;
  level?: number;
}) {
  const [animated, setAnimated] = useState(true);
  const [visible, setVisible] = useState(true);
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      threshold: 0,
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const mood = busy && presence !== 'exito' ? 'pensando' : MOOD[presence];
  const listening = presence === 'escucha' && !busy;
  const style = { '--denta-level': listening ? Math.min(1, Math.max(0, level)).toFixed(2) : '0' } as CSSProperties;
  return (
    <button
      ref={ref}
      type="button"
      className={`copilot-avatar${listening ? ' is-listening' : ''}`}
      style={style}
      aria-label="Animación de Denta"
      aria-pressed={animated}
      title={animated ? 'Pausar animación de Denta' : 'Reanudar animación de Denta'}
      onClick={() => setAnimated((value) => !value)}
    >
      <DentaMascot
        size={48}
        mood={mood}
        animate={animated && visible}
        blink={animated && visible && mood === 'neutral'}
      />
    </button>
  );
}
