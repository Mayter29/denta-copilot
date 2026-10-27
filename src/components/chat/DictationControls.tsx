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
  const label = recording ? 'Stop and transcribe' : 'Record with microphone';
  return (
    <>
      {active ? (
        <button
          className="composer-audio"
          type="button"
          onClick={dictation.cancel}
          aria-label="Discard dictation"
          title="Discard dictation"
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
            ? 'Stop and send the audio to Meta for a draft transcript'
            : 'Record up to 60 seconds. Stopping sends the audio to Meta for a transcript.'
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
          <label htmlFor="dictation-overflow">Saved transcript</label>
          <textarea id="dictation-overflow" value={dictation.transcript} readOnly />
          <button
            type="button"
            onClick={() => {
              onUseTranscript(dictation.transcript);
              dictation.finishReview();
            }}
          >
            Use as the new draft
          </button>
        </div>
      ) : null}
      {dictation.phase === 'retry' ? (
        <button type="button" className="dictation-retry" onClick={dictation.retry}>
          Retry transcription
        </button>
      ) : null}
    </>
  );
}
