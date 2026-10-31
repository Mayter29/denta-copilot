import { expect, it } from 'vitest';
import { settleBars, waveBars, WAVE_SILENCE } from './wave';

const tone = (length: number, amplitude: number) =>
  Float32Array.from({ length }, (_, n) => amplitude * Math.sin(n / 3));

it('reparte el bloque en barras con su nivel real, de izquierda a derecha', () => {
  const samples = new Float32Array(400);
  samples.set(tone(200, 0.1), 200); // silencio y luego voz
  const bars = waveBars(samples, 4);
  expect(bars).toHaveLength(4);
  expect(bars.slice(0, 2)).toEqual([0, 0]);
  expect(bars[2]).toBeGreaterThan(0.5);
});

it('la voz baja con supresión de ruido sigue siendo visible y el ruido de sala no', () => {
  const quietSpeech = waveBars(tone(2048, 0.01), 8); // ≈ −43 dBFS
  expect(Math.min(...quietSpeech)).toBeGreaterThan(0.2);
  const roomNoise = waveBars(tone(2048, 0.0015), 8); // ≈ −60 dBFS
  expect(Math.max(...roomNoise)).toBeLessThan(WAVE_SILENCE);
});

it('satura en 1 y no inventa barras sin audio', () => {
  expect(waveBars(new Float32Array(8).fill(1), 2)).toEqual([1, 1]);
  expect(waveBars(new Float32Array(0), 4)).toEqual([]);
});

it('las barras suben al instante y bajan suave', () => {
  expect(settleBars([0, 0], [0.8, 0.2])).toEqual([0.8, 0.2]);
  const fallen = settleBars([0.8, 0.2], [0, 0.5]);
  expect(fallen[0]).toBeCloseTo(0.48);
  expect(fallen[1]).toBe(0.5);
});
