'use client';
import { WAVE_BARS, WAVE_SILENCE } from '@/lib/client/wave';
import { DICTATION_MAX_SECONDS } from '@/lib/domain/pcm';

function clock(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}
const flat: readonly number[] = Array.from({ length: WAVE_BARS }, () => 0);

/**
 * Compact, centered recording wave drawn from the latest measured chunk (0–1 per bar).
 * Without signal it rests as short gray bars; it never invents motion.
 */
export function RecordingMeter({
  levels,
  seconds,
  label,
}: {
  levels: readonly number[];
  seconds: number;
  label: string;
}) {
  const bars = levels.length ? levels : flat;
  const silent = bars.every((level) => level < WAVE_SILENCE);
  const middle = (bars.length - 1) / 2 || 1;
  return (
    <div className="recording-meter" role="status" aria-live="polite" aria-label={label}>
      <div className={`recording-wave${silent ? ' silent' : ''}`} aria-hidden="true">
        {bars.map((level, index) => {
          // Levels arrive already on a perceptual (dB) scale.
          const amount = Math.min(1, Math.max(0, level));
          const edge = Math.abs(index - middle) / middle;
          return (
            <span
              // Fixed slots: each bar is a position in the block, not an item.
              key={index}
              style={{
                height: `${2 + amount * 34}px`,
                opacity: silent ? undefined : 0.35 + 0.65 * amount,
                background: silent
                  ? undefined
                  : `color-mix(in oklab, var(--accent) ${Math.round(100 - edge * 55)}%, var(--info))`,
              }}
            />
          );
        })}
      </div>
      <span className={`recording-dot${silent ? ' silent' : ''}`} aria-hidden="true" />
      <span className="recording-clock">
        {clock(seconds)}
        <span> / {clock(DICTATION_MAX_SECONDS)}</span>
      </span>
    </div>
  );
}
