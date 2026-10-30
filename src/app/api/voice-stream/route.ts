import { randomUUID } from 'node:crypto';
import { apiError, guardLocal, RequestError, sessionId } from '@/lib/server/workspace';

export const runtime = 'nodejs';

/**
 * Server-side bridge to Meta realtime transcription.
 * The browser streams raw PCM16 mono (never the provider key) over this
 * request body; the bridge relays it to wss://api.meta.ai/v1/asr/realtime
 * and returns transcript events as SSE. Verified against
 * https://dev.meta.ai/docs/speech-to-text. Not WebRTC: the provider exposes
 * no WebRTC, TTS or ephemeral tokens for this service.
 */

const META_ASR = 'wss://api.meta.ai/v1/asr/realtime';
const MODEL = 'muse-voice-transcribe-1.0';
const BYTES_PER_SECOND = 16_000 * 2;
const MAX_BYTES = BYTES_PER_SECOND * 125;
const HANDSHAKE_TIMEOUT_MS = 10_000;

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
  removeEventListener?: (
    type: 'open' | 'message' | 'close' | 'error',
    listener: (event: { data?: unknown; code?: number }) => void,
  ) => void;
};

const createSocket: (url: string) => MetaSocket = (url) =>
  new WebSocket(url) as unknown as MetaSocket;

function sse(send: (event: string, data: unknown) => void) {
  return send;
}

export async function POST(request: Request) {
  try {
    guardLocal(request, true);
    await sessionId();
    const apiKey = process.env.META_API_KEY || process.env.MODEL_API_KEY;
    if (!apiKey) throw new RequestError('Falta configurar la clave de Meta.', 503);
    const url = new URL(request.url);
    const mode = url.searchParams.get('mode') === 'PUSH_TO_TALK' ? 'PUSH_TO_TALK' : 'ENDPOINTING';
    const session = url.searchParams.get('sessionId') || `live-${randomUUID()}`;
    const body = request.body?.getReader();
    if (!body) throw new RequestError('Sin audio para transcribir.', 400);

    const meta = createSocket(`${META_ASR}?sessionId=${encodeURIComponent(session)}`);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Meta no respondió al inicio.')), HANDSHAKE_TIMEOUT_MS);
      const onOpen = () => {
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
      };
      const onMessage = ({ data }: { data?: unknown }) => {
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
      };
      const onError = () => {
        clearTimeout(timer);
        reject(new Error('No se pudo abrir la sesión de voz con Meta.'));
      };
      meta.addEventListener('open', onOpen);
      meta.addEventListener('message', onMessage);
      meta.addEventListener('error', onError);
    });

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let closed = false;
        const emit = sse((event: string, data: unknown) => {
          if (closed) return;
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        });
        const finish = () => {
          if (closed) return;
          closed = true;
          try {
            controller.close();
          } catch {
            // Already closed by the client going away.
          }
        };
        request.signal.addEventListener('abort', () => {
          try {
            meta.close(1000);
          } catch {
            // Best effort on teardown.
          }
          void body.cancel().catch(() => {});
          finish();
        });

        meta.addEventListener('message', ({ data }: { data?: unknown }) => {
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
              try {
                meta.close(1000);
              } catch {
                // Already closing after a provider error.
              }
              finish();
              break;
            default:
              // speechStart/speechEnd/speaker/unknown: forward-compatible ignore.
              break;
          }
        });
        meta.addEventListener('close', ({ code }: { code?: number }) => {
          if (!closed) emit('done', { code: code ?? 1000 });
          finish();
        });
        meta.addEventListener('error', () => {
          if (!closed) emit('error', { message: 'Conexión de transcripción interrumpida.' });
          finish();
        });

        try {
          let sent = 0;
          for (;;) {
            const part = await body.read();
            if (part.done) break;
            const chunk = part.value;
            if (sent + chunk.byteLength > MAX_BYTES) break;
            sent += chunk.byteLength;
            meta.send(chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength) as ArrayBuffer);
          }
        } catch {
          // Client upload interrupted; still flush what Meta already processed.
        } finally {
          try {
            meta.send(JSON.stringify({ type: 'endStream' }));
          } catch {
            finish();
          }
        }
      },
      cancel() {
        try {
          meta.close(1000);
        } catch {
          // Teardown is best effort.
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
