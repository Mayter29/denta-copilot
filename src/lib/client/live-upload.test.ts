import { expect, it, vi } from 'vitest';
import { LIVE_CHUNK_BYTES, LiveUploader } from './live-upload';

type Call = { op: string; id: string; bytes: number[] };

function fakeBridge(respond: (call: Call) => Response = () => new Response(null, { status: 204 })) {
  const calls: Call[] = [];
  const send = vi.fn(async (url: string, body?: Uint8Array) => {
    const query = new URL(url, 'http://127.0.0.1:3420').searchParams;
    const call = { op: query.get('op') ?? '', id: query.get('id') ?? '', bytes: body ? [...body] : [] };
    calls.push(call);
    // Yield so concurrent flushes would interleave if they were not serialized.
    await new Promise((resolve) => setTimeout(resolve, 0));
    return respond(call);
  });
  return { calls, send };
}

const pcm = (from: number, length: number) => Uint8Array.from({ length }, (_, i) => (from + i) % 256);

it('guarda el audio hasta tener ID y luego lo envía en orden, en bloques de ~250 ms', async () => {
  const bridge = fakeBridge();
  const uploader = new LiveUploader(vi.fn(), bridge.send);
  uploader.push(pcm(0, LIVE_CHUNK_BYTES));
  uploader.push(pcm(0, LIVE_CHUNK_BYTES));
  expect(bridge.calls).toEqual([]);
  uploader.attach('stream-1');
  await uploader.close();
  expect(bridge.calls.map((c) => c.op)).toEqual(['audio', 'audio', 'end']);
  expect(bridge.calls.every((c) => c.id === 'stream-1')).toBe(true);
  expect(bridge.calls.slice(0, 2).every((c) => c.bytes.length === LIVE_CHUNK_BYTES)).toBe(true);
});

it('al cerrar manda el resto aunque no complete un bloque, y después end', async () => {
  const bridge = fakeBridge();
  const uploader = new LiveUploader(vi.fn(), bridge.send);
  uploader.attach('s');
  uploader.push(pcm(7, 100));
  await uploader.close();
  expect(bridge.calls.map((c) => [c.op, c.bytes.length])).toEqual([
    ['audio', 100],
    ['end', 0],
  ]);
  expect(bridge.calls[0].bytes[0]).toBe(7);
});

it('si se detiene antes del ID, vacía y cierra en cuanto llega', async () => {
  const bridge = fakeBridge();
  const uploader = new LiveUploader(vi.fn(), bridge.send);
  uploader.push(pcm(0, 64));
  await uploader.close();
  expect(bridge.calls).toEqual([]);
  uploader.attach('late');
  await vi.waitFor(() => expect(bridge.calls.map((c) => c.op)).toEqual(['audio', 'end']));
});

it('un rechazo del puente detiene el envío y avisa una sola vez', async () => {
  const onError = vi.fn();
  const bridge = fakeBridge(() => Response.json({ error: 'La sesión de voz ya terminó.' }, { status: 404 }));
  const uploader = new LiveUploader(onError, bridge.send);
  uploader.attach('gone');
  uploader.push(pcm(0, LIVE_CHUNK_BYTES * 2));
  await uploader.close();
  expect(onError).toHaveBeenCalledTimes(1);
  expect(onError).toHaveBeenCalledWith('La sesión de voz ya terminó.');
  expect(bridge.calls.map((c) => c.op)).toEqual(['audio']);
});

it('cancelar no envía nada más', async () => {
  const bridge = fakeBridge();
  const uploader = new LiveUploader(vi.fn(), bridge.send);
  uploader.push(pcm(0, LIVE_CHUNK_BYTES));
  uploader.abandon();
  uploader.attach('s');
  await uploader.close();
  expect(bridge.calls).toEqual([]);
});
