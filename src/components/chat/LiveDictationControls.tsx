'use client';
import { AudioLines, LoaderCircle, Square, X } from 'lucide-react';
import type { useLiveDictation } from './useLiveDictation';

type Live = ReturnType<typeof useLiveDictation>;

export function LiveDictationControls({ live, disabled }: { live: Live; disabled: boolean }) {
  const streaming = live.phase === 'streaming';
  const busy = live.phase === 'connecting';
  const active = streaming || busy;
  return (
    <>
      {active ? (
        <button
          className="composer-audio"
          type="button"
          onClick={live.cancel}
          aria-label="Descartar voz en vivo"
          title="Descartar voz en vivo"
        >
          <X size={19} />
        </button>
      ) : null}
      <button
        type="button"
        className={`composer-audio${streaming ? ' is-recording' : ''}`}
        aria-label={streaming ? 'Detener voz en vivo' : 'Dictar en vivo con Meta'}
        title={
          streaming
            ? 'Detener. Los turnos confirmados quedan en el borrador para revisar y enviar.'
            : 'Transcripción continua con Meta. Los turnos se confirman al borrador; nada se envía solo.'
        }
        disabled={disabled || busy}
        onClick={() => {
          if (streaming) void live.stop();
          else void live.start();
        }}
      >
        {busy ? (
          <LoaderCircle size={19} className="spinner" />
        ) : streaming ? (
          <Square size={17} fill="currentColor" />
        ) : (
          <AudioLines size={20} />
        )}
      </button>
    </>
  );
}

export function LiveDictationFeedback({
  live,
  onUseTranscript,
}: {
  live: Live;
  onUseTranscript: (text: string) => void;
}) {
  return (
    <>
      {live.error ? (
        <div className="error-message" role="alert">
          {live.error}
        </div>
      ) : null}
      {live.phase === 'streaming' && live.partial ? (
        <p className="live-partial" role="status" aria-live="polite">
          {live.partial}
        </p>
      ) : null}
      {live.overflow ? (
        <div className="dictation-review">
          <label htmlFor="live-overflow">Transcripción conservada</label>
          <textarea id="live-overflow" value={live.overflow} readOnly />
          <button
            type="button"
            onClick={() => {
              onUseTranscript(live.overflow);
              live.cancel();
            }}
          >
            Usar como nuevo borrador
          </button>
        </div>
      ) : null}
    </>
  );
}
