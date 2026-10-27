import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MicrophoneCapture, microphoneError } from './microphone';
import { wavDuration } from '../domain/wav';

const track = { stop: vi.fn(), onended: null as (() => void) | null };
const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
const source = { connect: vi.fn(), disconnect: vi.fn() };
const getMedia = vi.fn();
const instances: { context?: FakeContext; node?: FakeNode } = {};
function context() {
  if (!instances.context) throw new Error('No context');
  return instances.context;
}
function node() {
  if (!instances.node) throw new Error('No node');
  return instances.node;
}
let capture: MicrophoneCapture;
const callbacks = { onProgress: vi.fn(), onLimit: vi.fn(), onInterrupted: vi.fn() };
class FakeContext {
  sampleRate = 16_000;
  state = 'running';
  destination = {};
  audioWorklet = { addModule: vi.fn(async () => {}) };
  onstatechange: (() => void) | null = null;
  resume = vi.fn(async () => {});
  close = vi.fn(async () => {
    this.state = 'closed';
  });
  createMediaStreamSource = vi.fn(() => source);
  constructor() {
    instances.context = this;
  }
}
class FakeNode {
  flush = true;
  port = {
    onmessage: null as ((event: { data: unknown }) => void) | null,
    postMessage: vi.fn(() => {
      if (this.flush) queueMicrotask(() => this.port.onmessage?.({ data: { type: 'finished' } }));
    }),
    close: vi.fn(),
  };
  connect = vi.fn();
  disconnect = vi.fn();
  onprocessorerror: (() => void) | null = null;
  constructor() {
    instances.node = this;
  }
  samples(count: number) {
    this.port.onmessage?.({
      data: { type: 'samples', samples: new Float32Array(count).fill(0.2) },
    });
  }
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  track.onended = null;
  vi.stubGlobal('isSecureContext', true);
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: getMedia } });
  vi.stubGlobal('AudioContext', FakeContext);
  vi.stubGlobal('AudioWorkletNode', FakeNode);
  getMedia.mockResolvedValue(stream);
  capture = new MicrophoneCapture(callbacks);
});
afterEach(() => {
  capture.cancel();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('captura, finaliza y libera recursos antes de devolver un WAV válido; no hace requests HTTP', async () => {
  const http = vi.fn();
  vi.stubGlobal('fetch', http);
  await capture.start();
  node().samples(16_000);
  const blob = await capture.stop();
  expect(track.stop).toHaveBeenCalledTimes(1);
  expect(context().close).toHaveBeenCalledTimes(1);
  expect(node().port.close).toHaveBeenCalled();
  expect(wavDuration(Buffer.from(await blob.arrayBuffer()))).toBe(1);
  expect(http).not.toHaveBeenCalled();
});
it('cancelar antes de conceder permiso cierra también un stream que llega tarde', async () => {
  let grant: (value: typeof stream) => void = () => {};
  getMedia.mockReturnValue(
    new Promise((resolve) => {
      grant = resolve;
    }),
  );
  const starting = capture.start();
  capture.cancel();
  grant(stream);
  await starting;
  expect(track.stop).toHaveBeenCalledTimes(1);
  expect(context().createMediaStreamSource).not.toHaveBeenCalled();
  expect(context().close).toHaveBeenCalled();
});
it('permiso denegado no deja contexto de audio ni entrega un blob', async () => {
  getMedia.mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'));
  await expect(capture.start()).rejects.toThrow('Permission denied');
  expect(context().close).toHaveBeenCalled();
  expect(microphoneError(new DOMException('', 'NotAllowedError'))).toContain('permiso');
});
it('falla claramente si la captura no está soportada', async () => {
  vi.stubGlobal('isSecureContext', false);
  await expect(capture.start()).rejects.toThrow('navegador');
  expect(getMedia).not.toHaveBeenCalled();
});
it('interrupción de dispositivo descarta y libera la captura', async () => {
  await capture.start();
  track.onended?.();
  expect(callbacks.onInterrupted).toHaveBeenCalledTimes(1);
  expect(track.stop).toHaveBeenCalled();
  await expect(capture.stop()).rejects.toThrow('no está disponible');
});
it('el límite retiene como máximo 60 segundos y notifica una sola vez por muestras', async () => {
  await capture.start();
  node().samples(960_100);
  node().samples(100);
  expect(callbacks.onLimit).toHaveBeenCalledTimes(1);
  const blob = await capture.stop();
  expect(wavDuration(Buffer.from(await blob.arrayBuffer()))).toBe(60);
});
it('el temporizador de límite se elimina al cancelar', async () => {
  await capture.start();
  capture.cancel();
  await vi.advanceTimersByTimeAsync(60_000);
  expect(callbacks.onLimit).not.toHaveBeenCalled();
});
it('timeout del worklet falla cerrado y libera micrófono y contexto', async () => {
  await capture.start();
  node().flush = false;
  const stopped = expect(capture.stop()).rejects.toThrow('finalizar');
  await vi.advanceTimersByTimeAsync(2000);
  await stopped;
  expect(track.stop).toHaveBeenCalled();
  expect(context().close).toHaveBeenCalled();
});
it('cancelar durante finalización impide entregar audio', async () => {
  await capture.start();
  node().flush = false;
  const stopped = expect(capture.stop()).rejects.toThrow('descartada');
  capture.cancel();
  await stopped;
});
it('resamplea con el navegador si el dispositivo entrega 48 kHz, manteniendo la duración', async () => {
  vi.stubGlobal(
    'AudioContext',
    class extends FakeContext {
      sampleRate = 48_000;
    },
  );
  const rates: number[] = [];
  const copied = vi.fn();
  vi.stubGlobal(
    'OfflineAudioContext',
    class {
      destination = {};
      constructor(
        _channels: number,
        private frames: number,
        rate: number,
      ) {
        rates.push(rate);
      }
      createBuffer(_channels: number, _length: number, rate: number) {
        rates.push(rate);
        return { copyToChannel: copied };
      }
      createBufferSource() {
        return { buffer: null, connect: vi.fn(), start: vi.fn() };
      }
      async startRendering() {
        return { getChannelData: () => new Float32Array(this.frames).fill(0.2) };
      }
    },
  );
  await capture.start();
  node().samples(48_000);
  const blob = await capture.stop();
  expect(rates).toEqual([16_000, 48_000]);
  expect(copied).toHaveBeenCalled();
  expect(wavDuration(Buffer.from(await blob.arrayBuffer()))).toBe(1);
  expect(track.stop).toHaveBeenCalled();
});
