'use client';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { MicrophoneCapture, microphoneError } from '@/lib/client/microphone';
import { transcribeWav } from '@/lib/client/transcription';

export type DictationPhase =
  'idle' | 'requesting' | 'recording' | 'stopping' | 'transcribing' | 'retry' | 'review';
type Options = {
  onTranscript: (text: string) => boolean;
  onActivityChange: (active: boolean) => void;
  onPresence?: (presence: { phase: DictationPhase; level: number }) => void;
};
export function useDictation({ onTranscript, onActivityChange, onPresence }: Options) {
  const [state, setState] = useState({
    phase: 'idle' as DictationPhase,
    seconds: 0,
    level: 0,
    error: '',
    transcript: '',
  });
  const phase = useRef<DictationPhase>('idle');
  const lastLevel = useRef(0);
  const capture = useRef<MicrophoneCapture | null>(null);
  const audio = useRef<Blob | null>(null);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);

  function transition(next: DictationPhase, error = '', transcript = '') {
    phase.current = next;
    lastLevel.current = 0;
    onActivityChange(next !== 'idle');
    // Event-driven presence for Denta; no effect needed downstream.
    onPresence?.({ phase: next, level: 0 });
    setState((previous) => ({ ...previous, phase: next, error, transcript }));
  }
  function cancel() {
    generation.current++;
    capture.current?.cancel();
    capture.current = null;
    request.current?.abort();
    request.current = null;
    audio.current = null;
    transition('idle');
  }
  async function transcribe(recording: Blob, token: number) {
    if (generation.current !== token) return;
    transition('transcribing');
    const controller = new AbortController();
    request.current = controller;
    try {
      const text = await transcribeWav(
        recording,
        AbortSignal.any([controller.signal, AbortSignal.timeout(50_000)]),
      );
      if (generation.current !== token) return;
      audio.current = null;
      if (onTranscript(text)) transition('idle');
      else
        transition(
          'review',
          'El texto no cabe junto al borrador actual. Copialo o elegí usarlo como nuevo borrador.',
          text,
        );
    } catch (error) {
      if (generation.current !== token) return;
      transition(
        'retry',
        error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)
          ? 'La transcripción tardó demasiado. Podés reintentar con el audio conservado.'
          : error instanceof Error
            ? error.message
            : 'No se pudo transcribir el audio.',
      );
    } finally {
      if (request.current === controller) request.current = null;
    }
  }
  async function stop() {
    if (phase.current !== 'recording' || !capture.current) return;
    const token = generation.current;
    const current = capture.current;
    transition('stopping');
    try {
      const recording = await current.stop();
      if (generation.current !== token) return;
      capture.current = null;
      audio.current = recording;
      await transcribe(recording, token);
    } catch (error) {
      if (generation.current === token) {
        capture.current = null;
        transition('idle', microphoneError(error));
      }
    }
  }
  async function start() {
    if (phase.current !== 'idle') return;
    const token = ++generation.current;
    transition('requesting');
    setState((previous) => ({ ...previous, seconds: 0, level: 0 }));
    const current = new MicrophoneCapture({
      onProgress: (seconds, level) => {
        if (generation.current !== token) return;
        // Throttle live level to avoid render churn; transitions go through transition().
        if (Math.abs(level - lastLevel.current) >= 0.08) {
          lastLevel.current = level;
          onPresence?.({ phase: 'recording', level });
        }
        setState((previous) => ({ ...previous, seconds, level }));
      },
      onLimit: () => {
        void stop();
      },
      onInterrupted: () => {
        if (generation.current === token) {
          generation.current++;
          capture.current = null;
          transition(
            'idle',
            'La grabación se interrumpió y fue descartada. Volvé a grabar cuando estés lista.',
          );
        }
      },
    });
    capture.current = current;
    try {
      await current.start();
      if (generation.current === token) transition('recording');
    } catch (error) {
      if (generation.current === token) {
        capture.current = null;
        transition('idle', microphoneError(error));
      }
    }
  }
  function retry() {
    if (phase.current === 'retry' && audio.current)
      void transcribe(audio.current, generation.current);
  }
  function finishReview() {
    if (phase.current === 'review') transition('idle');
  }
  const discard = useEffectEvent(() => {
    // Never keep recording after the page has left the foreground.
    if (document.visibilityState === 'hidden' && capture.current) {
      generation.current++;
      capture.current.cancel();
      capture.current = null;
      transition(
        'idle',
        'La grabación se descartó al salir de la página. Volvé a grabar para continuar.',
      );
    }
  });
  const pageExit = useEffectEvent(() => {
    cancel();
  });
  const dispose = useEffectEvent(() => {
    generation.current++;
    capture.current?.cancel();
    request.current?.abort();
    audio.current = null;
  });
  useEffect(() => {
    document.addEventListener('visibilitychange', discard);
    window.addEventListener('pagehide', pageExit);
    return () => {
      dispose();
      document.removeEventListener('visibilitychange', discard);
      window.removeEventListener('pagehide', pageExit);
    };
  }, []);
  return { ...state, start, stop, cancel, retry, finishReview };
}
