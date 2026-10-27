'use client';
import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { ArrowUp, Command, LoaderCircle, ShieldCheck } from 'lucide-react';
import { appendTranscript } from '@/lib/client/transcription';
import { useDictation, type DictationPhase } from './useDictation';
import { DictationControls, DictationFeedback } from './DictationControls';

const labels: Record<DictationPhase, string> = {
  idle: 'Dictate into the draft · up to 60 s',
  requesting: 'Waiting for microphone permission…',
  recording: 'Recording on this device',
  stopping: 'Preparing the audio…',
  transcribing: 'Transcribing with Meta…',
  retry: 'Audio still needs transcription',
  review: 'Review the transcript',
};
const disclosures: Partial<Record<DictationPhase, string>> = {
  transcribing: 'Audio was sent to Meta. Cancel stops the wait and does not change the draft.',
  retry:
    'The audio was already sent to Meta. Retry sends it again. Discard removes it from this session.',
  review: 'Transcript ready. Choose how to place it in the draft.',
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
          Message to Denta
        </label>
        <textarea
          ref={textareaRef}
          id="chat-draft"
          value={draft}
          maxLength={2000}
          disabled={disabled || active}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="Ask Denta to confirm, reschedule, or follow up…"
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
            aria-label="Send message"
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
            <meter aria-label="Microphone level" min={0} max={1} value={dictation.level} />
          </>
        ) : null}
      </div>
      <div className="composer-hint">
        <span>
          <Command size={12} /> Enter to send · Shift + Enter for a new line
        </span>
        <span>{draft.length}/2000</span>
      </div>
      <p className="dictation-caption">
        {disclosures[dictation.phase] ??
          'Stopping, or reaching 60 s, sends the audio to Meta. Cancel first to keep it here.'}
      </p>
      <p className="composer-disclaimer">
        <ShieldCheck size={12} />
        Fictional data only. Review the draft, then confirm each card.
      </p>
    </>
  );
}
