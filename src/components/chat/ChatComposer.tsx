'use client';
import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { ArrowUp, Command, LoaderCircle, ShieldCheck } from 'lucide-react';
import { appendTranscript } from '@/lib/client/transcription';
import { useDictation, type DictationPhase } from './useDictation';
import { DictationControls, DictationFeedback } from './DictationControls';

const labels: Record<DictationPhase, string> = {
  idle: 'Dictado a borrador · hasta 60 s',
  requesting: 'Esperando permiso del micrófono…',
  recording: 'Grabando en este dispositivo',
  stopping: 'Preparando el audio…',
  transcribing: 'Transcribiendo con Meta…',
  retry: 'Audio pendiente de transcripción',
  review: 'Revisá la transcripción',
};
const disclosures: Partial<Record<DictationPhase, string>> = {
  transcribing:
    'Audio enviado a Meta. Cancelar detiene la espera e impide añadir texto al borrador.',
  retry:
    'El audio ya se envió a Meta. Reintentar vuelve a enviarlo; descartarlo lo elimina de esta sesión.',
  review: 'Texto transcrito. Elegí cómo incorporarlo al borrador.',
};
type Props = {
  draft: string;
  onDraftChange: (text: string) => void;
  onSend: () => void;
  disabled: boolean;
  busy: boolean;
  onActivityChange: (active: boolean) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
};
export function ChatComposer({
  draft,
  onDraftChange,
  onSend,
  disabled,
  busy,
  onActivityChange,
  textareaRef,
}: Props) {
  const onTranscript = useCallback(
    (text: string) => {
      const merged = appendTranscript(draft, text);
      if (merged === null) return false;
      onDraftChange(merged);
      textareaRef.current?.focus();
      return true;
    },
    [draft, onDraftChange, textareaRef],
  );
  const dictation = useDictation({ onTranscript, onActivityChange });
  const active = dictation.phase !== 'idle';
  const recording = dictation.phase === 'recording';
  const pending = ['requesting', 'stopping', 'transcribing'].includes(dictation.phase);
  const hadWork = useRef(false);
  useEffect(() => {
    if (busy || active) hadWork.current = true;
    else if (hadWork.current) {
      hadWork.current = false;
      textareaRef.current?.focus();
    }
  }, [busy, active, textareaRef]);
  return (
    <>
      <DictationFeedback dictation={dictation} onUseTranscript={onDraftChange} />
      <form
        className={`composer${busy || pending ? ' composer-busy' : ''}${recording ? ' composer-recording' : ''}`}
        onSubmit={(event) => {
          event.preventDefault();
          if (!disabled && !active) onSend();
        }}
        aria-busy={busy || pending}
      >
        <label htmlFor="chat-draft" className="sr-only">
          Mensaje al copiloto
        </label>
        <textarea
          ref={textareaRef}
          id="chat-draft"
          value={draft}
          maxLength={2000}
          disabled={disabled || active}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="Preguntame algo o prepará una cita…"
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              if (!disabled && !active) onSend();
            }
          }}
        />
        <div className="composer-actions">
          <DictationControls dictation={dictation} disabled={disabled} />
          <button
            className="send-button"
            type="submit"
            aria-label="Enviar mensaje"
            disabled={disabled || active || !draft.trim()}
          >
            {busy ? <LoaderCircle size={19} className="spinner" /> : <ArrowUp size={20} />}
          </button>
        </div>
      </form>
      <div className="dictation-status">
        <span role="status" aria-live="polite">
          {labels[dictation.phase]}
        </span>
        {recording ? (
          <>
            <span aria-hidden="true"> · {String(dictation.seconds).padStart(2, '0')} / 60 s</span>
            <meter aria-label="Nivel del micrófono" min={0} max={1} value={dictation.level} />
          </>
        ) : null}
      </div>
      <div className="composer-hint">
        <span>
          <Command size={12} /> Enter para enviar · Shift + Enter para nueva línea
        </span>
        <span>{draft.length}/2000</span>
      </div>
      <p className="dictation-caption">
        {disclosures[dictation.phase] ??
          'Al detener, o a los 60 s, se envía a Meta. Cancelá antes para no enviarlo.'}
      </p>
      <p className="composer-disclaimer">
        <ShieldCheck size={12} />
        Solo datos ficticios. Revisá el texto antes de enviarlo y confirmá cada cambio.
      </p>
    </>
  );
}
