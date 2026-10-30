'use client';
import { Clock3 } from 'lucide-react';

/** Clickable HH:MM chips parsed from the assistant text. They fill the draft, never send. */
export function TimeChips({ text, onPick, disabled }: { text: string; onPick: (time: string) => void; disabled?: boolean }) {
  const times = [...new Set(text.match(/\b([01]\d|2[0-3]):[0-5]\d\b/g) ?? [])].slice(0, 6);
  if (!times.length) return null;
  return (
    <div className="time-chips" aria-label="Horarios mencionados">
      <Clock3 size={14} aria-hidden="true" />
      {times.map((time) => (
        <button
          key={time}
          type="button"
          disabled={disabled}
          onClick={() => onPick(time)}
          title={`Usar el espacio de las ${time}`}
        >
          {time}
        </button>
      ))}
    </div>
  );
}
