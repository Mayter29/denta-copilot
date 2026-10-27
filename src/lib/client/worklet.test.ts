import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';

type Processor = {
  port: { onmessage: (event: { data: string }) => void };
  process: (input: Float32Array[][], output: Float32Array[][]) => boolean;
};
function processor() {
  const messages: { type: string; samples?: Float32Array }[] = [];
  let instance: Processor | undefined;
  runInNewContext(readFileSync('public/audio/pcm-capture.js', 'utf8'), {
    AudioWorkletProcessor: class {
      port = {
        postMessage: (message: (typeof messages)[number]) => messages.push(message),
        onmessage: undefined,
      };
    },
    registerProcessor: (_name: string, Constructor: new () => Processor) => {
      instance = new Constructor();
    },
    Float32Array,
    sampleRate: 16_000,
  });
  if (!instance) throw new Error('Processor not registered');
  return { instance, messages };
}
it('el worklet transmite el último bloque parcial una vez y nunca reproduce el micrófono', () => {
  const { instance, messages } = processor();
  const output = new Float32Array(128).fill(1);
  for (let i = 0; i < 17; i++)
    expect(instance.process([[new Float32Array(128).fill(0.25)]], [[output]])).toBe(true);
  expect(output.every((sample) => sample === 0)).toBe(true);
  instance.port.onmessage({ data: 'finish' });
  instance.port.onmessage({ data: 'finish' });
  expect(messages.map((message) => message.type)).toEqual(['samples', 'samples', 'finished']);
  expect(messages[0].samples?.length).toBe(2048);
  expect(messages[1].samples?.length).toBe(128);
  expect(instance.process([[new Float32Array(128)]], [[output]])).toBe(false);
});
it('el hilo de audio corta a 60 segundos aunque el controlador no haya recibido el límite', () => {
  const { instance, messages } = processor();
  instance.process([[new Float32Array(16_000 * 61).fill(0.2)]], [[new Float32Array(128)]]);
  instance.process([[new Float32Array(128).fill(0.2)]], [[new Float32Array(128)]]);
  expect(messages.filter((message) => message.type === 'limit')).toHaveLength(1);
  expect(messages.reduce((total, message) => total + (message.samples?.length ?? 0), 0)).toBe(
    16_000 * 60,
  );
  instance.port.onmessage({ data: 'finish' });
  expect(messages.at(-1)?.type).toBe('finished');
});
