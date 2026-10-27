'use client';
import { useEffect, useRef, type RefObject } from 'react';
import Markdown from 'react-markdown';
import {
  ArrowUpRight,
  CalendarDays,
  CheckCheck,
  LoaderCircle,
  MessageCircle,
  Sparkles,
} from 'lucide-react';
import type { WorkspaceView } from './useWorkspaceSession';
import { ProposalCard } from '../ProposalCard';
import { DentaMascot } from '../brand/DentaMascot';
import { DentaAvatar } from '../brand/DentaAvatar';
import { ChatComposer } from '../chat/ChatComposer';

const suggestions = [
  {
    icon: CalendarDays,
    title: 'Find an opening',
    text: 'What openings does Dr. Valeria have tomorrow for a cleaning?',
  },
  {
    icon: MessageCircle,
    title: 'Follow up',
    text: 'Who has not confirmed or missed a visit? Draft a Spanish follow-up for Luis Solís.',
  },
  {
    icon: Sparkles,
    title: 'Move a visit',
    text: 'Show Ana Mora’s appointment first, then help me move it.',
  },
];
const resultLabels = {
  proposal: 'Pending confirmation',
  needs_input: 'Needs a detail',
  paused: 'Turn paused',
  failed: 'Verification failed',
  answer: 'Information',
};

export function StaffPanel({
  state,
  draft,
  onDraftChange,
  onSend,
  onDecide,
  busy,
  audioActive,
  error,
  onActivityChange,
  textareaRef,
}: {
  state: WorkspaceView;
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onDecide: (id: string, approved: boolean) => void;
  busy: boolean;
  audioActive: boolean;
  error: string;
  onActivityChange: (active: boolean) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [state.messages.length, state.proposals.length, busy]);
  return (
    <section className="staff-panel" aria-labelledby="denta-heading">
      <div className="panel-heading">
        <DentaAvatar busy={busy} />
        <div>
          <p className="eyebrow">2 · Staff assistant</p>
          <h1 id="denta-heading">Denta</h1>
          <p>Confirms, moves, and follows up. You approve every change.</p>
        </div>
      </div>
      <div className="conversation" aria-live="polite" aria-busy={busy}>
        {!state.messages.length ? (
          <div className="welcome">
            <h2>
              Today’s book, ready for a decision.
              <span> Denta prepares the card. You confirm it.</span>
            </h2>
            <div className="suggestions">
              {suggestions.map(({ icon: Icon, title, text }) => (
                <button key={title} type="button" onClick={() => onDraftChange(text)}>
                  <Icon size={18} />
                  <strong>{title}</strong>
                  <span>{text}</span>
                  <ArrowUpRight size={15} />
                </button>
              ))}
            </div>
            <p className="trust-line">
              <CheckCheck size={15} />A yes in chat does not change the schedule or message a
              patient.
            </p>
          </div>
        ) : (
          <div className="messages">
            {state.messages.map((message) => (
              <article key={message.id} className={`message ${message.role}`}>
                <div className="message-avatar">
                  {message.role === 'assistant' ? <DentaMascot size={29} blink={false} /> : 'Y'}
                </div>
                <div>
                  <span className="message-author">
                    {message.role === 'assistant' ? 'Denta' : 'You'}
                  </span>
                  <div className="message-content">
                    {message.result ? (
                      <p>
                        <strong>{resultLabels[message.result.kind]}</strong>
                        {' · '}No schedule changes in this turn
                      </p>
                    ) : null}
                    <Markdown>{message.content}</Markdown>
                    {message.result?.sources.map((source) => (
                      <details key={source.id}>
                        <summary>Source: {source.title}</summary>
                        <p lang="es">{source.content}</p>
                      </details>
                    ))}
                  </div>
                </div>
              </article>
            ))}
            {state.proposals.map((proposal) => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                busy={busy || audioActive}
                onDecide={onDecide}
              />
            ))}
          </div>
        )}
        {busy ? (
          <div className="thinking" role="status">
            <LoaderCircle size={17} className="spinner" />
            Denta is checking the book…
          </div>
        ) : null}
        <div ref={bottom} />
      </div>
      <div className="composer-area">
        {error ? (
          <div className="error-message" role="alert">
            {error}
          </div>
        ) : null}
        <ChatComposer
          draft={draft}
          onDraftChange={onDraftChange}
          onSend={onSend}
          disabled={busy}
          busy={busy}
          onActivityChange={onActivityChange}
          textareaRef={textareaRef}
        />
      </div>
    </section>
  );
}
