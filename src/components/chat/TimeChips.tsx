'use client';
import { Clock3 } from 'lucide-react';

/** Clickable HH:MM chips parsed from the assistant text. They fill the draft, never send. */
export function TimeChips({ text, onPick, disabled }: { text: string; onPick: (time: string) => void; disabled?: boolean }) {
  // Range bounds ("de 08:00 a 16:00", "entre 08:00 y 12:00") describe hours, not offered slots.
  const offered = text.replace(/\b(de|entre)\s+\d{1,2}:\d{2}\s+(a|y|hasta)\s+\d{1,2}:\d{2}/gi, '');
  const times = [...new Set(offered.match(/\b([01]\d|2[0-3]):[0-5]\d\b/g) ?? [])].slice(0, 6);
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
