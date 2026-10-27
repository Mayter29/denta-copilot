import { expect, it } from 'vitest';
import { wavDuration } from './wav';
function wav(seconds: number) {
  const data = Buffer.alloc(44 + seconds * 32000);
  data.write('RIFF');
  data.writeUInt32LE(data.length - 8, 4);
  data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22);
  data.writeUInt32LE(16000, 24);
  data.writeUInt32LE(32000, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write('data', 36);
  data.writeUInt32LE(data.length - 44, 40);
  return data;
}
it('acepta PCM mono 16 kHz hasta 60 segundos', () => {
  expect(wavDuration(wav(60))).toBe(60);
});
it('rechaza duración excesiva, formato inválido y archivo truncado', () => {
  expect(() => wavDuration(wav(61))).toThrow();
  expect(() => wavDuration(wav(0.5))).toThrow();
  const stereo = wav(1);
  stereo.writeUInt16LE(2, 22);
  expect(() => wavDuration(stereo)).toThrow();
  expect(() => wavDuration(wav(2).subarray(0, 60))).toThrow();
  expect(() => wavDuration(Buffer.from('audio falso'))).toThrow();
});
