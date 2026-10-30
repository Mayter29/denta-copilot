'use client';
import { useEffect, useRef, useState } from 'react';
import { MicrophoneCapture, microphoneError } from '@/lib/client/microphone';

export type LivePhase = 'idle' | 'connecting' | 'streaming' | 'error';

type Options = {
  onCommit: (text: string) => boolean;
  onActivityChange: (active: boolean) => void;
  onPresence?: (presence: { phase: 'idle' | 'requesting' | 'recording'; level: number }) => void;
};

const floatToPcm16 = (samples: Float32Array) => {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const value = Math.max(-1, Math.min(1, samples[i]));
    out[i] = Math.round(value * (value < 0 ? 32768 : 32767));
  }
  return new Uint8Array(out.buffer);
};

type BridgeEvent = { event: string; data: string };

async function* readSse(body: ReadableStream<Uint8Array>): AsyncGenerator<BridgeEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      buffer += decoder.decode(part.value, { stream: true });
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() ?? '';
      for (const block of blocks) {
        const event = block.match(/^event: (.+)$/m)?.[1]?.trim() ?? '';
        const data = block.match(/^data: (.+)$/m)?.[1] ?? '';
        if (event) yield { event, data };
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Continuous voice input through the server bridge to Meta realtime ASR.
 * Partials only preview; committed turns merge into the draft and the user
 * still sends manually. Same guarantees as file dictation: no auto-send,
 * late results are ignored, the mic releases on stop.
 */
export function useLiveDictation({ onCommit, onActivityChange, onPresence }: Options) {
  const [state, setState] = useState({
    phase: 'idle' as LivePhase,
    seconds: 0,
    level: 0,
    error: '',
    partial: '',
    overflow: '',
  });
  const phase = useRef<LivePhase>('idle');
  const generation = useRef(0);
  const capture = useRef<MicrophoneCapture | null>(null);
  const writer = useRef<WritableStreamDefaultWriter<Uint8Array> | null>(null);
  const abort = useRef<AbortController | null>(null);

  function transition(next: LivePhase, patch: Partial<typeof state> = {}) {
    phase.current = next;
    onActivityChange(next === 'connecting' || next === 'streaming');
    // Event-driven presence for Denta; the file flow reports the same way.
    onPresence?.({
      phase: next === 'connecting' ? 'requesting' : next === 'streaming' ? 'recording' : 'idle',
      level: 0,
    });
    setState((previous) => ({ ...previous, phase: next, ...patch }));
  }

  function teardown() {
    capture.current?.cancel();
    capture.current = null;
    writer.current = null;
    abort.current?.abort();
    abort.current = null;
  }

  function cancel() {
    generation.current++;
    teardown();
    transition('idle', { partial: '', overflow: '' });
  }

  async function stop() {
    if (phase.current !== 'streaming' && phase.current !== 'connecting') return;
    const token = generation.current;
    // Release the microphone immediately; committed turns still arrive.
    capture.current?.cancel();
    capture.current = null;
    try {
      await writer.current?.close();
    } catch {
      // Upload already torn down; pending turns still flush through SSE.
    }
    writer.current = null;
    if (generation.current === token)
      setState((previous) => ({ ...previous, partial: '' }));
  }

  async function start() {
    if (phase.current !== 'idle' && phase.current !== 'error') return;
    const token = ++generation.current;
    teardown();
    transition('connecting', { error: '', partial: '', overflow: '' });
    const controller = new AbortController();
    abort.current = controller;
    const pipe = new TransformStream<Uint8Array, Uint8Array>();
    const upload = pipe.readable;
    const write = pipe.writable.getWriter();
    writer.current = write;
    const fail = (message: string) => {
      if (generation.current !== token) return;
      teardown();
      transition('error', { error: message, partial: '' });
    };
    try {
      const mic = new MicrophoneCapture({
        onProgress: (seconds, level) => {
          if (generation.current === token && phase.current === 'streaming')
            setState((previous) => ({ ...previous, seconds, level }));
        },
        onLimit: () => void stop(),
        onInterrupted: () => fail('El audio se interrumpió. Volvé a intentar.'),
        onSamples: (samples) => {
          if (generation.current !== token || phase.current !== 'streaming') return;
          try {
            void write.write(floatToPcm16(samples)).catch(() => {});
          } catch {
            // Upload torn down; the SSE tail still flushes pending turns.
          }
        },
      });
      capture.current = mic;
      await mic.start();
      if (generation.current !== token) return;
      if (mic.inputRate !== 16_000) {
        fail(
          'Este dispositivo entrega audio a otra frecuencia. Usá el dictado por archivo: graba, revisá el texto y envialo.',
        );
        return;
      }
      transition('streaming');
      const response = await fetch('/api/voice-stream?mode=ENDPOINTING', {
        method: 'POST',
        body: upload,
        signal: controller.signal,
        // @ts-expect-error Duplex half is required for streaming uploads.
        duplex: 'half',
      });
      if (generation.current !== token) return;
      if (!response.ok || !response.body) {
        const body: unknown = await response.json().catch(() => null);
        const message =
          body && typeof body === 'object' && 'error' in body ? String((body as { error: unknown }).error) : '';
        fail(message || 'No se pudo abrir la sesión de voz en vivo.');
        return;
      }
      for await (const { event, data } of readSse(response.body)) {
        if (generation.current !== token) return;
        try {
          const parsed = JSON.parse(data) as { transcript?: string; message?: string };
          if (event === 'partial' && typeof parsed.transcript === 'string')
            setState((previous) => ({ ...previous, partial: parsed.transcript as string }));
          else if (event === 'turn' && typeof parsed.transcript === 'string' && parsed.transcript.trim()) {
            setState((previous) => ({ ...previous, partial: '' }));
            if (!onCommit(parsed.transcript)) {
              if (generation.current !== token) return;
              teardown();
              transition('error', {
                error: 'El texto no cabe junto al borrador actual. Usalo como borrador nuevo.',
                overflow: parsed.transcript,
              });
              return;
            }
          } else if (event === 'error') {
            fail(typeof parsed.message === 'string' ? parsed.message : 'Transcripción interrumpida.');
            return;
          } else if (event === 'done') {
            if (generation.current !== token) return;
            teardown();
            transition('idle', { partial: '' });
            return;
          }
        } catch {
          // Malformed SSE payload; keep the session alive.
        }
      }
      if (generation.current !== token) return;
      teardown();
      transition('idle', { partial: '' });
    } catch (error) {
      if (generation.current !== token) return;
      if (error instanceof Error && (error.name === 'AbortError' || controller.signal.aborted)) {
        teardown();
        transition('idle', { partial: '' });
        return;
      }
      teardown();
      transition(
        'error',
        microphoneError(error) !== 'No se pudo grabar el audio. Volvé a intentar.'
          ? { error: microphoneError(error) }
          : { error: error instanceof Error ? error.message : 'No se pudo iniciar la voz en vivo.' },
      );
    }
  }

  function useOverflow() {
    if (!state.overflow) return;
    if (onCommit(state.overflow)) {
      const token = generation.current;
      if (generation.current === token) transition('idle', { overflow: '', error: '' });
    }
  }

  useEffect(
    () => () => {
      generation.current++;
      teardown();
    },
    [],
  );

  return { ...state, start, stop, cancel, useOverflow };
}
