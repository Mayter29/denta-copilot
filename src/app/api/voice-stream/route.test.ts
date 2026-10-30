import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { POST } from './route';

vi.mock('@/lib/server/workspace', async (original) => ({
  ...(await original<typeof import('@/lib/server/workspace')>()),
  sessionId: vi.fn(async () => '00000000-0000-4000-8000-000000000001'),
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

const sseEvents = async (response: Response) => {
  const events: { event: string; data: string }[] = [];
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const part = await reader.read();
    if (part.done) break;
    buffer += decoder.decode(part.value, { stream: true });
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() ?? '';
    for (const block of blocks) {
      const event = block.match(/^event: (.+)$/m)?.[1]?.trim() ?? '';
      const data = block.match(/^data: (.+)$/m)?.[1] ?? '';
      if (event) events.push({ event, data });
    }
  }
  return events;
};

beforeEach(() => {
  FakeMetaSocket.instances = [];
  vi.stubEnv('DEMO_MODE', 'true');
  vi.stubEnv('META_API_KEY', 'fake-test-key');
  vi.stubGlobal('WebSocket', FakeMetaSocket);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const post = (body: ReadableStream<Uint8Array>) =>
  POST(
    new Request('http://127.0.0.1:3420/api/voice-stream?mode=ENDPOINTING', {
      method: 'POST',
      headers: { host: '127.0.0.1:3420', origin: 'http://127.0.0.1:3420' },
      body: body as BodyInit,
      // @ts-expect-error Duplex half is required for streaming uploads.
      duplex: 'half',
    }),
  );

it('autentica en el servidor, reenvía PCM y publica parciales y turnos', async () => {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const upload = new ReadableStream<Uint8Array>({ start: (c) => void (controller = c) });
  const pending = post(upload);
  const response = await pending;
  expect(response.status).toBe(200);
  expect(response.headers.get('Content-Type')).toBe('text/event-stream');
  const socket = FakeMetaSocket.instances[0];
  expect(socket.url.startsWith('wss://api.meta.ai/v1/asr/realtime')).toBe(true);
  const handshake = socket.handshake();
  expect(handshake).toMatchObject({
    audioEncoding: 'PCM_16KHZ',
    model: 'muse-voice-transcribe-1.0',
    mode: 'ENDPOINTING',
    languageBias: ['Spanish'],
  });
  expect((handshake.authorization as { accessToken: string }).accessToken).toBe('Bearer fake-test-key');

  const collected = sseEvents(response);
  const pcm = new Uint8Array([1, 2, 3, 4]).buffer as ArrayBuffer;
  controller.enqueue(new Uint8Array(pcm));
  socket.emit('message', { data: JSON.stringify({ type: 'transcript', transcript: 'buenos', audioProcessedMs: 240 }) });
  socket.emit('message', {
    data: JSON.stringify({ type: 'speechComplete', turnId: 1, transcript: 'Buenos días.', audioProcessedMs: 480 }),
  });
  controller.close();
  const events = await collected;
  expect(socket.binaries()).toHaveLength(1);
  expect(events.map((e) => e.event)).toEqual(['partial', 'turn', 'done']);
  expect(JSON.parse(events[0].data)).toEqual({ transcript: 'buenos' });
  expect(JSON.parse(events[1].data)).toEqual({ transcript: 'Buenos días.', turnId: 1 });
  expect(socket.sent.at(-1)).toBe(JSON.stringify({ type: 'endStream' }));
});

it('propaga el error de Meta como evento sin exponer la clave', async () => {
  const upload = new ReadableStream<Uint8Array>({ start: (c) => c.close() });
  const response = await post(upload);
  expect(response.status).toBe(200);
  const socket = FakeMetaSocket.instances[0];
  const collected = sseEvents(response);
  socket.emit('message', { data: JSON.stringify({ type: 'error', message: 'rate limited' }) });
  const events = await collected;
  expect(events[0]).toMatchObject({ event: 'error' });
  expect(JSON.stringify(events)).not.toContain('fake-test-key');
});

it('sin clave de Meta responde 503 sin abrir socket', async () => {
  vi.stubEnv('META_API_KEY', '');
  vi.stubEnv('MODEL_API_KEY', '');
  const upload = new ReadableStream<Uint8Array>({ start: (c) => c.close() });
  const response = await post(upload);
  expect(response.status).toBe(503);
  expect(FakeMetaSocket.instances).toHaveLength(0);
});
