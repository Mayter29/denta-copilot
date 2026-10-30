// Live transcription protocol client for Meta ASR realtime.
// Verified against https://dev.meta.ai/docs/speech-to-text (wss://api.meta.ai/v1/asr/realtime).
// This machine speaks WebSocket + JSON/binary frames only. It is NOT WebRTC: the provider
// exposes no WebRTC, TTS, ephemeral tokens or voice-to-voice endpoints, so this project
// must not present dictation, SSE or this client as WebRTC.
// The browser must never hold the provider key: the handshake authorization is injected
// by the server bridge, which is why this client connects to our own bridge instead.

export type LiveMode = 'PUSH_TO_TALK' | 'ENDPOINTING' | 'DIARIZATION';
export type LiveState = 'idle' | 'connecting' | 'streaming' | 'completing' | 'closed';

export type LiveTurn = { turnId: number; transcript: string; final: boolean };
export type LiveEvents = {
  onPartial?: (turn: LiveTurn) => void;
  onTurn?: (turn: { turnId: number; transcript: string }) => void;
  onError?: (message: string, recoverable: boolean) => void;
  onBackpressure?: (pendingBytes: number) => void;
  onClose?: (code: number, ended: boolean) => void;
};

export type LiveSocket = {
  send: (data: string | ArrayBuffer | Uint8Array) => void;
  close: (code?: number) => void;
  onmessage: ((event: { data: string | ArrayBuffer }) => void) | null;
  onclose: ((event: { code: number }) => void) | null;
  onerror: (() => void) | null;
};

export type LiveConfig = {
  sessionId?: string;
  model?: string;
  mode?: LiveMode;
  languageBias?: string[];
  keywords?: string[];
  emitAudioProgress?: boolean;
};

/** Close codes that allow a fresh session with backoff (no resume token exists). */
export function canRetryLiveSession(code: number) {
  return code === 1013 || code === 1011 || code === 1006;
}

const serverEvent = (raw: string): ({ type: string } & Record<string, unknown>) | null => {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || typeof (parsed as { type?: unknown }).type !== 'string') return null;
    return parsed as { type: string } & Record<string, unknown>;
  } catch {
    return null;
  }
};

export function createLiveTranscription(socket: LiveSocket, config: LiveConfig = {}, events: LiveEvents = {}) {
  const model = config.model ?? 'muse-voice-transcribe-1.0';
  let state: LiveState = 'idle';
  let activeTurn: number | null = null;
  let lastPartial = '';
  let sentBytes = 0;
  let ackedBytes = 0;
  let ended = false;

  const fail = (message: string, recoverable: boolean) => {
    if (state === 'closed') return;
    state = 'closed';
    events.onError?.(message, recoverable);
  };

  return {
    get state() {
      return state;
    },
    /** First frame the bridge forwards with server-injected authorization. Key never reaches the browser. */
    handshakeFrame() {
      return JSON.stringify({
        authorization: { accessToken: 'Bearer <server-injected>' },
        audioEncoding: 'PCM_16KHZ',
        model,
        mode: config.mode ?? 'PUSH_TO_TALK',
        partialMode: 'CUMULATIVE',
        emitAudioProgress: config.emitAudioProgress ?? false,
        ...(config.languageBias ? { languageBias: config.languageBias } : {}),
        ...(config.keywords ? { keywords: config.keywords } : {}),
      });
    },
    start() {
      if (state !== 'idle') return;
      state = 'connecting';
      socket.onmessage = ({ data }) => {
        if (typeof data !== 'string') return;
        if (state === 'connecting') {
          // Handshake acknowledgement carries no `type` field.
          try {
            const ack: unknown = JSON.parse(data);
            if (ack && typeof ack === 'object' && !('type' in (ack as Record<string, unknown>))) {
              state = 'streaming';
              return;
            }
          } catch {
            // Fall through to event handling.
          }
        }
        const event = serverEvent(data);
        if (!event) return;
        switch (event.type) {
          case 'speechStart':
            activeTurn = typeof event.turnId === 'number' ? event.turnId : activeTurn;
            lastPartial = '';
            break;
          case 'transcript': {
            // CUMULATIVE: each partial supersedes the previous one for the active turn.
            const text = typeof event.transcript === 'string' ? event.transcript : '';
            lastPartial = text;
            events.onPartial?.({ turnId: activeTurn ?? 0, transcript: text, final: event.final === true });
            if (event.final === true) {
              events.onTurn?.({ turnId: activeTurn ?? 0, transcript: text });
              if ((config.mode ?? 'PUSH_TO_TALK') === 'PUSH_TO_TALK') {
                state = 'completing';
                ended = true;
              }
            }
            break;
          }
          case 'speechEnd':
            break;
          case 'speechComplete': {
            const text = typeof event.transcript === 'string' ? event.transcript : lastPartial;
            const turnId = typeof event.turnId === 'number' ? event.turnId : (activeTurn ?? 0);
            events.onTurn?.({ turnId, transcript: text });
            break;
          }
          case 'audioProgress': {
            // The server reports processed audio; derive acknowledged bytes (16 kHz mono int16).
            if (typeof event.audioProcessedMs === 'number') {
              ackedBytes = Math.max(ackedBytes, Math.floor(event.audioProcessedMs * 32));
              const backlog = sentBytes - ackedBytes;
              if (backlog > 160_000) events.onBackpressure?.(backlog);
            }
            break;
          }
          case 'error':
            fail(typeof event.message === 'string' ? event.message : 'Transcripción interrumpida.', true);
            break;
          default:
            // Forward-compatible: ignore unknown server event types.
            break;
        }
      };
      socket.onerror = () => fail('Conexión de transcripción interrumpida.', true);
      socket.onclose = ({ code }) => {
        if (state === 'closed') return;
        const done = code === 1000;
        state = 'closed';
        events.onClose?.(code, ended || done);
      };
    },
    /** Pace audio at approximately real time; the server rejects streams that run ahead. */
    sendAudio(chunk: ArrayBuffer | Uint8Array) {
      if (state !== 'streaming') return;
      sentBytes += chunk.byteLength;
      // 16 kHz mono int16 = 32_000 bytes/s; warn past a 5 s backlog.
      if (sentBytes - ackedBytes > 160_000) events.onBackpressure?.(sentBytes - ackedBytes);
      socket.send(chunk);
    },
    /** Ends input explicitly; the socket stays open until the server flushes and closes. */
    endStream() {
      if (state !== 'streaming') return;
      socket.send(JSON.stringify({ type: 'endStream' }));
      state = 'completing';
    },
    close() {
      if (state === 'closed') return;
      state = 'closed';
      socket.close(1000);
    },
  };
}
