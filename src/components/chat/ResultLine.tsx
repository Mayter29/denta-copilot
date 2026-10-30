'use client';
import { CheckCheck } from 'lucide-react';

const labels = {
  proposal: 'Propuesta pendiente · sin cambios aplicados',
  needs_input: 'Denta necesita un dato',
  paused: 'Turno pausado',
  failed: 'No se verificó el turno',
  answer: 'Verificada · sin cambios de agenda',
} as const;

export type ResultKind = keyof typeof labels;

/** Discreet verified-turn indicator. Display only; never a write receipt. */
export function ResultLine({ kind }: { kind: ResultKind }) {
  return (
    <p className="verified-line">
      <CheckCheck size={13} aria-hidden="true" />
      {labels[kind]}
    </p>
  );
}
