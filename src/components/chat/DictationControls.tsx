import { LoaderCircle, Mic, Square, X } from 'lucide-react';
import type { useDictation } from './useDictation';

type Dictation = ReturnType<typeof useDictation>;
export function DictationControls({
  dictation,
  disabled,
}: {
  dictation: Dictation;
  disabled: boolean;
}) {
  const recording = dictation.phase === 'recording';
  const active = dictation.phase !== 'idle';
  const pending = ['requesting', 'stopping', 'transcribing'].includes(dictation.phase);
  const label = recording ? 'Detener y transcribir' : 'Grabar con micrófono';
  return (
    <>
      {active ? (
        <button
          className="composer-audio"
          type="button"
          onClick={dictation.cancel}
          aria-label="Descartar dictado"
          title="Descartar dictado"
        >
          <X size={19} />
        </button>
      ) : null}
      <button
        type="button"
        className={`composer-audio${recording ? ' is-recording' : ''}`}
        aria-label={label}
        title={
          recording
            ? 'Detener y enviar el audio a Meta para transcribir a borrador'
            : 'Grabar hasta 60 segundos. Al detener, el audio se envía a Meta para transcribir.'
        }
        disabled={disabled || (active && !recording)}
        onClick={() => {
          if (recording) void dictation.stop();
          else void dictation.start();
        }}
      >
        {pending ? (
          <LoaderCircle size={19} className="spinner" />
        ) : recording ? (
          <Square size={17} fill="currentColor" />
        ) : (
          <Mic size={20} />
        )}
      </button>
    </>
  );
}

export function DictationFeedback({
  dictation,
  onUseTranscript,
}: {
  dictation: Dictation;
  onUseTranscript: (text: string) => void;
}) {
  return (
    <>
      {dictation.error ? (
        <div className="error-message" role="alert">
          {dictation.error}
        </div>
      ) : null}
      {dictation.phase === 'review' ? (
        <div className="dictation-review">
          <label htmlFor="dictation-overflow">Transcripción conservada</label>
          <textarea id="dictation-overflow" value={dictation.transcript} readOnly />
          <button
            type="button"
            onClick={() => {
              onUseTranscript(dictation.transcript);
              dictation.finishReview();
            }}
          >
            Usar como nuevo borrador
          </button>
        </div>
      ) : null}
      {dictation.phase === 'retry' ? (
        <button type="button" className="dictation-retry" onClick={dictation.retry}>
          Reintentar transcripción
        </button>
      ) : null}
    </>
  );
}
