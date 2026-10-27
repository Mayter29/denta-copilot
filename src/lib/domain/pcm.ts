export const DICTATION_SAMPLE_RATE = 16_000;
export const DICTATION_MAX_SECONDS = 60;

/** Encode mono samples at 16 kHz. The browser resamples before this boundary. */
export function encodePcmWav(samples: Float32Array): ArrayBuffer {
  if (samples.length < DICTATION_SAMPLE_RATE)
    throw new Error('Grabá al menos un segundo antes de transcribir.');
  if (samples.length > DICTATION_SAMPLE_RATE * DICTATION_MAX_SECONDS)
    throw new Error('La grabación supera los 60 segundos.');
  let peak = 0;
  for (const sample of samples) {
    if (!Number.isFinite(sample)) throw new Error('No se pudo leer el audio. Volvé a grabar.');
    peak = Math.max(peak, Math.abs(sample));
  }
  if (peak < 0.00001) throw new Error('No se detectó audio. Revisá el micrófono y volvé a grabar.');
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const write = (at: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(at + i, text.charCodeAt(i));
  };
  write(0, 'RIFF');
  view.setUint32(4, buffer.byteLength - 8, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, DICTATION_SAMPLE_RATE, true);
  view.setUint32(28, DICTATION_SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const value = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true);
  }
  return buffer;
}
