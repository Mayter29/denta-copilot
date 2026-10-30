'use client';
import { useState } from 'react';
import { DentaMascot, type DentaActivity, type DentaMood } from './DentaMascot';

export type DentaPresence = 'reposo' | 'escucha' | 'transcribe' | 'consulta' | 'exito';
const MOOD: Record<DentaPresence, DentaMood> = {
  reposo: 'neutral',
  escucha: 'sorprendido',
  transcribe: 'pensando',
  consulta: 'pensando',
  exito: 'feliz',
};
const ACTIVITY: Record<DentaPresence, DentaActivity> = {
  reposo: 'idle',
  escucha: 'listening',
  transcribe: 'transcribing',
  consulta: 'thinking',
  exito: 'idle',
};

/** Product adapter: chat/dictation presence -> rig mood/activity/level. No audio, model or agenda logic here. */
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
  const effective: DentaPresence = busy && presence !== 'exito' ? 'consulta' : presence;
  const listening = effective === 'escucha';
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
        mood={MOOD[effective]}
        activity={ACTIVITY[effective]}
        level={listening ? level : 0}
        blink={effective === 'reposo'}
        interactive={animated}
        paused={!animated}
      />
    </button>
  );
}
