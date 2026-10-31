import { randomUUID } from 'node:crypto';
import { apiError, guardLocal, RequestError, sessionId } from '@/lib/server/workspace';

export const runtime = 'nodejs';

/**
 * Server-side bridge to Meta realtime transcription, over plain HTTP/1.1.
 *
 * Chrome rejects streaming request bodies on HTTP/1.x, so the browser cannot
 * keep one long upload open against `next dev`. Instead (the two-request
 * pattern from developer.chrome.com/docs/capabilities/web-apis/fetch-streaming-requests):
 *   - `?op=start`  opens the Meta WebSocket and answers with SSE; the first event
 *                  is `ready {id}`, then partials/turns/progress/done.
 *   - `?op=audio&id=` short POSTs with raw PCM16 mono 16 kHz, relayed in order.
 *   - `?op=end&id=`   asks Meta to drain (`endStream`); the SSE tail flushes.
 * The provider key never leaves the server. Each stream belongs to the signed
 * demo cookie that opened it. Not WebRTC: Meta exposes no WebRTC, TTS or
 * ephemeral tokens for this service (dev.meta.ai/docs/speech-to-text).
 */

const META_ASR = 'wss://api.meta.ai/v1/asr/realtime';
const MODEL = 'muse-voice-transcribe-1.0';
const BYTES_PER_SECOND = 16_000 * 2;
const MAX_BYTES = BYTES_PER_SECOND * 125;
/** One POST carries a few hundred ms; anything larger is not live audio. */
const MAX_CHUNK_BYTES = BYTES_PER_SECOND * 2;
const HANDSHAKE_TIMEOUT_MS = 10_000;
/** Without audio for this long the stream is drained and closed. */
const IDLE_MS = 15_000;

const DENTAL_KEYWORDS = [
  'Denta',
  'Brisa Dental',
  'Valeria',
  'Andrés',
  'Camila',
  'Marco',
  'valoración',
  'limpieza',
  'extracción',
  'ortodoncia',
];

type MetaSocket = {
  send: (data: string | ArrayBufferLike) => void;
  close: (code?: number) => void;
  addEventListener: (
    type: 'open' | 'message' | 'close' | 'error',
    listener: (event: { data?: unknown; code?: number }) => void,
  ) => void;
};

const createSocket: (url: string) => MetaSocket = (url) =>
  new WebSocket(url) as unknown as MetaSocket;

type LiveStream = {
  owner: string;
  meta: MetaSocket;
  sent: number;
  ended: boolean;
  idle: ReturnType<typeof setTimeout> | undefined;
  close: () => void;
};

// One local process (see AGENTS.md). Kept on globalThis so dev reloads of this
// module do not orphan open streams.
const registry = globalThis as typeof globalThis & { __dentaLiveStreams?: Map<string, LiveStream> };
const streams = (registry.__dentaLiveStreams ??= new Map());

function endStream(stream: LiveStream) {
  if (stream.ended) return;
  stream.ended = true;
  clearTimeout(stream.idle);
  try {
    stream.meta.send(JSON.stringify({ type: 'endStream' }));
  } catch {
    stream.close();
  }
}

function touch(stream: LiveStream) {
  clearTimeout(stream.idle);
  stream.idle = setTimeout(() => endStream(stream), IDLE_MS);
}

function owned(id: string | null, owner: string) {
  const stream = id ? streams.get(id) : undefined;
  // Same answer for unknown and foreign IDs.
  if (!stream || stream.owner !== owner) throw new RequestError('La sesión de voz ya terminó.', 404);
  return stream;
}

async function openMeta(apiKey: string, mode: string) {
  const meta = createSocket(`${META_ASR}?sessionId=${encodeURIComponent(`live-${randomUUID()}`)}`);
  const handshake = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Meta no respondió al inicio.')), HANDSHAKE_TIMEOUT_MS);
    meta.addEventListener('open', () => {
      meta.send(
        JSON.stringify({
          authorization: { accessToken: `Bearer ${apiKey}` },
          audioEncoding: 'PCM_16KHZ',
          model: MODEL,
          mode,
          partialMode: 'CUMULATIVE',
          emitAudioProgress: true,
          languageBias: ['Spanish'],
          keywords: DENTAL_KEYWORDS,
        }),
      );
    });
    meta.addEventListener('message', ({ data }) => {
      if (typeof data !== 'string') return;
      try {
        const ack = JSON.parse(data) as { sessionId?: string };
        if (ack && typeof ack === 'object' && !('type' in ack) && ack.sessionId) {
          clearTimeout(timer);
          resolve();
        }
      } catch {
        // Handshake acknowledgement is JSON; anything else is a protocol violation.
        clearTimeout(timer);
        reject(new Error('Respuesta inválida del servicio de voz.'));
      }
    });
    meta.addEventListener('error', () => {
      clearTimeout(timer);
      reject(new Error('No se pudo abrir la sesión de voz con Meta.'));
    });
  });
  try {
    await handshake;
  } catch (error) {
    try {
      meta.close(1000);
    } catch {
      // The socket never opened.
    }
    throw error;
  }
  return meta;
}

function start(request: Request, owner: string, meta: MetaSocket) {
  const id = randomUUID();
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const emit = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      const stream: LiveStream = {
        owner,
        meta,
        sent: 0,
        ended: false,
        idle: undefined,
        close: () => {
          if (closed) return;
          closed = true;
          clearTimeout(stream.idle);
          streams.delete(id);
          try {
            meta.close(1000);
          } catch {
            // Best effort on teardown.
          }
          try {
            controller.close();
          } catch {
            // Already closed by the client going away.
          }
        },
      };
      // A new live session replaces any previous one of the same person.
      for (const [otherId, other] of streams) if (other.owner === owner && otherId !== id) other.close();
      streams.set(id, stream);
      touch(stream);
      request.signal.addEventListener('abort', stream.close);
      emit('ready', { id });

      meta.addEventListener('message', ({ data }) => {
        if (typeof data !== 'string' || closed) return;
        let event: { type?: unknown; transcript?: unknown; final?: unknown; turnId?: unknown; audioProcessedMs?: unknown; message?: unknown };
        try {
          event = JSON.parse(data) as typeof event;
        } catch {
          return;
        }
        if (!event || typeof event.type !== 'string') return;
        switch (event.type) {
          case 'transcript':
            if (typeof event.transcript === 'string' && event.transcript) {
              if (event.final === true) emit('turn', { transcript: event.transcript });
              else emit('partial', { transcript: event.transcript });
            }
            break;
          case 'speechComplete':
            if (typeof event.transcript === 'string' && event.transcript)
              emit('turn', { transcript: event.transcript, turnId: event.turnId });
            break;
          case 'audioProgress':
            if (typeof event.audioProcessedMs === 'number')
              emit('progress', { audioProcessedMs: event.audioProcessedMs });
            break;
          case 'error':
            emit('error', {
              message: typeof event.message === 'string' ? event.message : 'Transcripción interrumpida.',
            });
            stream.close();
            break;
          default:
            // speechStart/speechEnd/speaker/unknown: forward-compatible ignore.
            break;
        }
      });
      meta.addEventListener('close', ({ code }) => {
        emit('done', { code: code ?? 1000 });
        stream.close();
      });
      meta.addEventListener('error', () => {
        emit('error', { message: 'Conexión de transcripción interrumpida.' });
        stream.close();
      });
    },
    cancel() {
      streams.get(id)?.close();
    },
  });
  return new Response(body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

export async function POST(request: Request) {
  try {
    guardLocal(request, true);
    const owner = await sessionId();
    const url = new URL(request.url);
    const op = url.searchParams.get('op') ?? 'start';

    if (op === 'audio') {
      const stream = owned(url.searchParams.get('id'), owner);
      const chunk = await request.arrayBuffer();
      if (!chunk.byteLength || chunk.byteLength > MAX_CHUNK_BYTES || chunk.byteLength % 2)
        throw new RequestError('Bloque de audio inválido.', 400);
      if (stream.ended) return new Response(null, { status: 204 });
      if (stream.sent + chunk.byteLength > MAX_BYTES) {
        endStream(stream);
        throw new RequestError('Se alcanzó el límite de la sesión de voz.', 413);
      }
      stream.sent += chunk.byteLength;
      stream.meta.send(chunk);
      touch(stream);
      return new Response(null, { status: 204 });
    }

    if (op === 'end') {
      endStream(owned(url.searchParams.get('id'), owner));
      return new Response(null, { status: 204 });
    }

    if (op !== 'start') throw new RequestError('Operación de voz desconocida.', 400);
    const apiKey = process.env.META_API_KEY || process.env.MODEL_API_KEY;
    if (!apiKey) throw new RequestError('Falta configurar la clave de Meta.', 503);
    const mode = url.searchParams.get('mode') === 'PUSH_TO_TALK' ? 'PUSH_TO_TALK' : 'ENDPOINTING';
    const meta = await openMeta(apiKey, mode);
    return start(request, owner, meta);
  } catch (error) {
    return apiError(error);
  }
}
