import { describe, expect, it, vi } from 'vitest';
import { canRetryLiveSession, createLiveTranscription, type LiveSocket } from './live-transcription';

function fakeSocket() {
  const sent: (string | ArrayBuffer | Uint8Array)[] = [];
  const socket: LiveSocket = {
    send: (data) => void sent.push(data),
    close: vi.fn(),
    onmessage: null,
    onclose: null,
    onerror: null,
  };
  return { socket, sent };
}
const emit = (socket: LiveSocket, data: string) => socket.onmessage?.({ data });
const ack = (socket: LiveSocket) => emit(socket, JSON.stringify({ sessionId: 's1' }));

describe('transcripción en vivo (protocolo documentado, sin red)', () => {
  it('espera el handshake sin tipo antes de transmitir', () => {
    const { socket } = fakeSocket();
    const live = createLiveTranscription(socket, { mode: 'ENDPOINTING' });
    live.start();
    expect(live.state).toBe('connecting');
    live.sendAudio(new Uint8Array(320));
    ack(socket);
    expect(live.state).toBe('streaming');
    const frame = JSON.parse(live.handshakeFrame() as string) as Record<string, unknown>;
    expect(frame.mode).toBe('ENDPOINTING');
    expect(frame.audioEncoding).toBe('PCM_16KHZ');
    expect(JSON.stringify(frame.authorization)).not.toContain('Bearer sk');
  });
  it('reemplaza parciales acumulados y cierra el turno por turnId', () => {
    const { socket } = fakeSocket();
    const partials: string[] = [];
    const turns: { turnId: number; transcript: string }[] = [];
    const live = createLiveTranscription(socket, { mode: 'ENDPOINTING' }, { onPartial: (t) => void partials.push(t.transcript), onTurn: (t) => void turns.push(t) });
    live.start();
    ack(socket);
    emit(socket, JSON.stringify({ type: 'speechStart', turnId: 1 }));
    emit(socket, JSON.stringify({ type: 'transcript', transcript: 'cómo está', final: false }));
    emit(socket, JSON.stringify({ type: 'transcript', transcript: 'cómo está el clima', final: false }));
    emit(socket, JSON.stringify({ type: 'speechEnd', turnId: 1 }));
    emit(socket, JSON.stringify({ type: 'speechComplete', turnId: 1, transcript: '¿Cómo está el clima?' }));
    expect(partials).toEqual(['cómo está', 'cómo está el clima']);
    expect(turns).toEqual([{ turnId: 1, transcript: '¿Cómo está el clima?' }]);
  });
  it('tolera turnos superpuestos e ignora eventos futuros desconocidos', () => {
    const { socket } = fakeSocket();
    const turns: number[] = [];
    const live = createLiveTranscription(socket, {}, { onTurn: (t) => void turns.push(t.turnId) });
    live.start();
    ack(socket);
    emit(socket, JSON.stringify({ type: 'speechStart', turnId: 1 }));
    emit(socket, JSON.stringify({ type: 'speechStart', turnId: 2 }));
    emit(socket, JSON.stringify({ type: 'wordConfidence', turnId: 2, words: [] }));
    emit(socket, JSON.stringify({ type: 'speechComplete', turnId: 1, transcript: 'uno' }));
    emit(socket, JSON.stringify({ type: 'speechComplete', turnId: 2, transcript: 'dos' }));
    expect(turns).toEqual([1, 2]);
  });
  it('endStream cierra la entrada y espera el cierre del servidor', () => {
    const { socket, sent } = fakeSocket();
    const closed: number[] = [];
    const live = createLiveTranscription(socket, {}, { onClose: (code) => void closed.push(code) });
    live.start();
    ack(socket);
    live.sendAudio(new Uint8Array(640));
    live.endStream();
    expect(live.state).toBe('completing');
    expect(sent.at(-1)).toBe(JSON.stringify({ type: 'endStream' }));
    socket.onclose?.({ code: 1000 });
    expect(closed).toEqual([1000]);
  });
  it('propaga errores del proveedor y clasifica reintentos por código', () => {
    const { socket } = fakeSocket();
    const errors: string[] = [];
    const live = createLiveTranscription(socket, {}, { onError: (m) => void errors.push(m) });
    live.start();
    ack(socket);
    emit(socket, JSON.stringify({ type: 'error', message: 'límite', sessionId: 's1' }));
    expect(errors).toEqual(['límite']);
    expect(live.state).toBe('closed');
    expect(canRetryLiveSession(1013)).toBe(true);
    expect(canRetryLiveSession(1000)).toBe(false);
    expect(canRetryLiveSession(4401)).toBe(false);
  });
  it('avisa antes de superar el ritmo permitido', () => {
    const { socket } = fakeSocket();
    const pressure: number[] = [];
    const live = createLiveTranscription(socket, {}, { onBackpressure: (b) => void pressure.push(b) });
    live.start();
    ack(socket);
    live.sendAudio(new Uint8Array(200_000));
    expect(pressure.length).toBe(1);
    expect(pressure[0]).toBeGreaterThan(160_000);
  });
});
