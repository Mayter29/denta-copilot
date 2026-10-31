/** Bars in the recording wave: a compact centered block, not the full composer width. */
export const WAVE_BARS = 40;
/** Below this every bar reads as room noise, so the wave rests gray. */
export const WAVE_SILENCE = 0.1;

// Decibel window mapped to 0–1. Noise-suppressed speech sits around −45…−20 dBFS, which a
// linear RMS scale squeezes near zero; dB keeps quiet and loud microphones readable.
const FLOOR_DB = -55;
const CEILING_DB = -10;

/**
 * Splits the latest microphone chunk into `count` loudness values (0–1), left to right.
 * Pure; never synthesizes signal.
 */
export function waveBars(samples: Float32Array, count = WAVE_BARS): number[] {
  if (!samples.length || count <= 0) return [];
  const step = samples.length / count;
  return Array.from({ length: count }, (_, bar) => {
    const start = Math.floor(bar * step);
    const end = Math.max(start + 1, Math.floor((bar + 1) * step));
    let sum = 0;
    for (let index = start; index < end; index++) sum += samples[index] ** 2;
    const rms = Math.sqrt(sum / (end - start));
    if (rms <= 0) return 0;
    const db = 20 * Math.log10(rms);
    return Math.min(1, Math.max(0, (db - FLOOR_DB) / (CEILING_DB - FLOOR_DB)));
  });
}

/** Fast rise, gentle fall between chunks so bars do not flicker. Only ever lowers toward measured values. */
export function settleBars(previous: readonly number[], next: number[]): number[] {
  return next.map((level, index) => Math.max(level, (previous[index] ?? 0) * 0.6));
}
