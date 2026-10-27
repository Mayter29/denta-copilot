import { expect, it } from 'vitest';
import { encodePcmWav } from './pcm';
import { wavDuration } from './wav';

it.each([1, 60])('genera WAV aceptado por el servidor, mono 16 kHz y 16 bits: %s s', (seconds) => {
  const samples = new Float32Array(16_000 * seconds).fill(0.25);
  const buffer = Buffer.from(encodePcmWav(samples));
  expect(wavDuration(buffer)).toBe(seconds);
  expect(buffer.length).toBe(44 + seconds * 32_000);
  expect(buffer.readUInt16LE(22)).toBe(1);
  expect(buffer.readUInt32LE(24)).toBe(16_000);
  expect(buffer.readUInt16LE(34)).toBe(16);
});
it('limita amplitudes sin desbordar PCM y conserva el signo', () => {
  const samples = new Float32Array(16_000).fill(0.1);
  samples.set([-2, -1, 0, 1, 2]);
  const buffer = Buffer.from(encodePcmWav(samples));
  expect(Array.from({ length: 5 }, (_, index) => buffer.readInt16LE(44 + index * 2))).toEqual([
    -32768, -32768, 0, 32767, 32767,
  ]);
});
it('rechaza audio vacío, demasiado corto, largo, no finito o completamente silencioso', () => {
  for (const samples of [
    new Float32Array(),
    new Float32Array(15_999).fill(0.1),
    new Float32Array(960_001).fill(0.1),
    new Float32Array(16_000).fill(NaN),
    new Float32Array(16_000),
    new Float32Array(16_000).fill(Infinity),
  ]) {
    expect(() => encodePcmWav(samples)).toThrow();
  }
});
