import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { POST } from './route';
import { sessionId } from '@/lib/server/workspace';

const OWNER = '00000000-0000-4000-8000-000000000001';
vi.mock('@/lib/server/workspace', async (original) => ({
  ...(await original<typeof import('@/lib/server/workspace')>()),
  sessionId: vi.fn(async () => OWNER),
}));

type Handler = (event: { data?: unknown; code?: number }) => void;

class FakeMetaSocket {
  static instances: FakeMetaSocket[] = [];
  sent: (string | ArrayBuffer)[] = [];
  private handlers = new Map<string, Handler[]>();
  constructor(public url: string) {
    FakeMetaSocket.instances.push(this);
    queueMicrotask(() => this.emit('open', {}));
  }
  send(data: string | ArrayBuffer) {
    this.sent.push(data);
    if (typeof data === 'string') {
      const message = JSON.parse(data) as { authorization?: unknown; type?: string };
      if (message.authorization)
        setTimeout(() => this.emit('message', { data: JSON.stringify({ sessionId: 'test-session' }) }), 0);
      if (message.type === 'endStream') setTimeout(() => this.emit('close', { code: 1000 }), 0);
    }
  }
  close() {
    setTimeout(() => this.emit('close', { code: 1000 }), 0);
  }
  addEventListener(type: string, handler: Handler) {
    const list = this.handlers.get(type) ?? [];
    list.push(handler);
    this.handlers.set(type, list);
  }
  emit(type: string, event: { data?: unknown; code?: number }) {
    for (const handler of this.handlers.get(type) ?? []) handler(event);
  }
  handshake() {
    return JSON.parse(this.sent.find((s) => typeof s === 'string') as string) as Record<string, unknown>;
  }
  binaries() {
    return this.sent.filter((s) => s instanceof ArrayBuffer);
  }
}

/** Reads SSE events one at a time while the response stays open. */
function sseReader(response: Response) {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const queued: { event: string; data: unknown }[] = [];
  return async function next(): Promise<{ event: string; data: unknown } | null> {
    for (;;) {
      if (queued.length) return queued.shift()!;
      const part = await reader.read();
      if (part.done) return null;
      buffer += decoder.decode(part.value, { stream: true });
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() ?? '';
      for (const block of blocks) {
        const event = block.match(/^event: (.+)$/m)?.[1]?.trim() ?? '';
        const data = block.match(/^data: (.+)$/m)?.[1] ?? 'null';
        if (event) queued.push({ event, data: JSON.parse(data) });
      }
    }
  };
}

const call = (query: string, body?: Uint8Array) =>
  POST(
    new Request(`http://127.0.0.1:3420/api/voice-stream?${query}`, {
      method: 'POST',
      headers: { host: '127.0.0.1:3420', origin: 'http://127.0.0.1:3420' },
      body: body as BodyInit | undefined,
    }),
  );

async function open() {
  const response = await call('op=start&mode=ENDPOINTING');
  const next = sseReader(response);
  const ready = await next();
  expect(ready?.event).toBe('ready');
  return { response, next, id: (ready!.data as { id: string }).id, socket: FakeMetaSocket.instances.at(-1)! };
}

beforeEach(() => {
  FakeMetaSocket.instances = [];
  vi.stubEnv('DEMO_MODE', 'true');
  vi.stubEnv('META_API_KEY', 'fake-test-key');
  vi.stubGlobal('WebSocket', FakeMetaSocket);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.mocked(sessionId).mockImplementation(async () => OWNER);
});

it('autentica en el servidor, recibe audio en POST cortos y publica parciales y turnos', async () => {
  const { response, next, id, socket } = await open();
  expect(response.headers.get('Content-Type')).toBe('text/event-stream');
  expect(socket.url.startsWith('wss://api.meta.ai/v1/asr/realtime')).toBe(true);
  const handshake = socket.handshake();
  expect(handshake).toMatchObject({
    audioEncoding: 'PCM_16KHZ',
    model: 'muse-voice-transcribe-1.0',
    mode: 'ENDPOINTING',
    languageBias: ['Spanish'],
  });
  expect((handshake.authorization as { accessToken: string }).accessToken).toBe('Bearer fake-test-key');

  expect((await call(`op=audio&id=${id}`, new Uint8Array([1, 2, 3, 4]))).status).toBe(204);
  expect((await call(`op=audio&id=${id}`, new Uint8Array([5, 6]))).status).toBe(204);
  expect(socket.binaries().map((b) => [...new Uint8Array(b as ArrayBuffer)])).toEqual([[1, 2, 3, 4], [5, 6]]);

  socket.emit('message', { data: JSON.stringify({ type: 'transcript', transcript: 'buenos', audioProcessedMs: 240 }) });
  socket.emit('message', {
    data: JSON.stringify({ type: 'speechComplete', turnId: 1, transcript: 'Buenos días.', audioProcessedMs: 480 }),
  });
  expect((await call(`op=end&id=${id}`)).status).toBe(204);
  expect(socket.sent.at(-1)).toBe(JSON.stringify({ type: 'endStream' }));

  const events = [await next(), await next(), await next(), await next()];
  expect(events.map((e) => e?.event)).toEqual(['partial', 'turn', 'done', undefined]);
  expect(events[0]?.data).toEqual({ transcript: 'buenos' });
  expect(events[1]?.data).toEqual({ transcript: 'Buenos días.', turnId: 1 });
  // The stream is gone once Meta closed it.
  expect((await call(`op=audio&id=${id}`, new Uint8Array([1, 2]))).status).toBe(404);
});

it('otra sesión de la demo no puede mandar audio ni cerrar un stream ajeno', async () => {
  const { id, socket } = await open();
  vi.mocked(sessionId).mockImplementation(async () => '00000000-0000-4000-8000-000000000002');
  expect((await call(`op=audio&id=${id}`, new Uint8Array([1, 2]))).status).toBe(404);
  expect((await call(`op=end&id=${id}`)).status).toBe(404);
  expect(socket.binaries()).toHaveLength(0);
  expect(socket.sent.some((s) => s === JSON.stringify({ type: 'endStream' }))).toBe(false);
});

it('rechaza bloques vacíos, impares o demasiado grandes', async () => {
  const { id, socket } = await open();
  expect((await call(`op=audio&id=${id}`, new Uint8Array([1, 2, 3]))).status).toBe(400);
  expect((await call(`op=audio&id=${id}`, new Uint8Array(70_000))).status).toBe(400);
  expect((await call(`op=audio&id=${id}`)).status).toBe(400);
  expect(socket.binaries()).toHaveLength(0);
});

it('propaga el error de Meta como evento sin exponer la clave', async () => {
  const { next, socket } = await open();
  socket.emit('message', { data: JSON.stringify({ type: 'error', message: 'rate limited' }) });
  const error = await next();
  expect(error).toMatchObject({ event: 'error', data: { message: 'rate limited' } });
  expect(JSON.stringify(error)).not.toContain('fake-test-key');
  expect(await next()).toBeNull();
});

it('sin clave de Meta responde 503 sin abrir socket', async () => {
  vi.stubEnv('META_API_KEY', '');
  vi.stubEnv('MODEL_API_KEY', '');
  const response = await call('op=start');
  expect(response.status).toBe(503);
  expect(FakeMetaSocket.instances).toHaveLength(0);
});

it('exige el origen local', async () => {
  const response = await POST(
    new Request('http://127.0.0.1:3420/api/voice-stream?op=start', {
      method: 'POST',
      headers: { host: '127.0.0.1:3420', origin: 'https://evil.example' },
    }),
  );
  expect(response.status).toBe(403);
  expect(FakeMetaSocket.instances).toHaveLength(0);
});
