import type { RefObject } from 'react';
import Markdown from 'react-markdown';
import {
  ArrowUpRight,
  CalendarDays,
  CheckCheck,
  LoaderCircle,
  MessageCircleWarning,
  Sparkles,
} from 'lucide-react';
import type { ChatEntry, Proposal } from '@/lib/domain/types';
import { DentaAvatar } from '../brand/DentaAvatar';
import { DentaMascot } from '../brand/DentaMascot';
import { ProposalCard } from '../ProposalCard';

const suggestions = [
  {
    icon: CalendarDays,
    title: 'Find an opening',
    text: 'What openings does Dra. Valeria have tomorrow for a cleaning?',
  },
  {
    icon: MessageCircleWarning,
    title: 'Follow up a no-show',
    text: 'Luis has not confirmed. Draft a Spanish follow-up and wait for my confirmation.',
  },
  {
    icon: Sparkles,
    title: 'Check the clinic',
    text: 'What are the hours and the price of an evaluation? Cite your sources.',
  },
];

const kinds: Record<string, string> = {
  proposal: 'Waiting for confirmation',
  needs_input: 'Needs a detail',
  paused: 'Turn paused',
  failed: 'Could not verify',
};

export function StaffConversation({
  messages,
  proposals,
  busy,
  modelReady,
  loaded,
  onChoose,
  onDecide,
  endRef,
}: {
  messages: ChatEntry[];
  proposals: Proposal[];
  busy: boolean;
  modelReady: boolean;
  loaded: boolean;
  onChoose: (text: string) => void;
  onDecide: (id: string, approved: boolean) => void;
  endRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <>
      <div className="chat-heading">
        <DentaAvatar busy={busy} />
        <div>
          <h1>Denta</h1>
          <p>
            <span className="status-dot" />
            {modelReady ? 'Meta connected · ready for the desk' : 'Meta key not configured'}
          </p>
        </div>
        <span className="model-pill">Muse Spark</span>
      </div>
      <div className="conversation" aria-live="polite" aria-busy={busy}>
        {!loaded ? (
          <div className="loading-state" role="status">
            <LoaderCircle size={18} className="spinner" aria-hidden="true" />
            Loading the reception desk…
          </div>
        ) : messages.length === 0 ? (
          <div className="welcome">
            <span className="welcome-kicker">
              <Sparkles size={14} aria-hidden="true" />
              FEWER NO-SHOWS
            </span>
            <h2>
              The desk, before the day gets away.
              <span> Denta prepares the next step. You decide.</span>
            </h2>
            <p>
              Ask in English. Patient messages stay in Spanish. Nothing is booked, moved, or sent
              until you confirm the card.
            </p>
            <div className="suggestions">
              {suggestions.map(({ icon: Icon, title, text }) => (
                <button key={title} type="button" onClick={() => onChoose(text)}>
                  <Icon size={20} aria-hidden="true" />
                  <strong>{title}</strong>
                  <span>{text}</span>
                  <ArrowUpRight size={15} aria-hidden="true" />
                </button>
              ))}
            </div>
            <div className="trust-line">
              <CheckCheck size={15} aria-hidden="true" />A yes in chat does not confirm. The card
              does.
            </div>
          </div>
        ) : (
          <div className="messages">
            {messages.map((message) => (
              <article key={message.id} className={`message ${message.role}`}>
                <div className="message-avatar" aria-hidden="true">
                  {message.role === 'assistant' ? <DentaMascot size={29} blink={false} /> : 'You'}
                </div>
                <div>
                  <span className="message-author">
                    {message.role === 'assistant' ? 'Denta' : 'You'}
                  </span>
                  <div className="message-content">
                    {message.result ? (
                      <p>
                        <strong>{kinds[message.result.kind] ?? 'Informational'}</strong>
                        {' · '}No schedule changes in this turn
                      </p>
                    ) : null}
                    <Markdown>{message.content}</Markdown>
                    {message.result?.sources.map((source) => (
                      <details key={source.id}>
                        <summary>Source: {source.title}</summary>
                        <p>{source.content}</p>
                      </details>
                    ))}
                  </div>
                </div>
              </article>
            ))}
            {proposals.map((proposal) => (
              <ProposalCard key={proposal.id} proposal={proposal} busy={busy} onDecide={onDecide} />
            ))}
          </div>
        )}
        {busy ? (
          <div className="thinking" role="status">
            <LoaderCircle size={17} className="spinner" aria-hidden="true" />
            Checking the schedule…
          </div>
        ) : null}
        <div ref={endRef} />
      </div>
    </>
  );
}
