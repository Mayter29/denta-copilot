'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import { CheckCheck, Sparkles } from 'lucide-react';
import type { ChatEntry, Proposal } from '@/lib/domain/types';
import { applyChatDelta, type ChatDelta } from '@/lib/domain/chat-delta';
import type { DailyInsights } from '@/lib/domain/insights';
import { ProposalList } from '../ProposalList';
import { BriefingCards } from '../briefing/BriefingCards';
import { TimeChips } from '../chat/TimeChips';
import { ResultLine } from '../chat/ResultLine';
import { DentaAvatar, type DentaPresence } from '../brand/DentaAvatar';
import { DentaMascot } from '../brand/DentaMascot';
import { ChatComposer } from '../chat/ChatComposer';
import { ChatProgress } from '../chat/ChatProgress';
import { useChatRequest } from '../chat/useChatRequest';
import type { DictationPhase } from '../chat/useDictation';
import { useAppContext } from './AppShell';

type Catalog = { doctors: { id: string; name: string }[]; services: { id: string; name: string }[] };

async function fetchJson(url: string, body?: unknown) {
  const response = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  if (!response.ok) {
    const data: unknown = await response.json().catch(() => null);
    const message =
      data && typeof data === 'object' && 'error' in data ? String((data as { error: unknown }).error) : '';
    throw new Error(message || 'No se pudo completar la solicitud.');
  }
  return (await response.json()) as Record<string, unknown>;
}

function MessageArticle({
  message,
  onPickTime,
  timeDisabled,
}: {
  message: ChatEntry;
  onPickTime?: (time: string) => void;
  timeDisabled?: boolean;
}) {
  return (
    <article className={`message ${message.role}`}>
      <div className="message-avatar">
        {message.role === 'assistant' ? (
          <DentaMascot size={29} blink={false} interactive={false} paused />
        ) : (
          'M'
        )}
      </div>
      <div>
        <span className="message-author">{message.role === 'assistant' ? 'Denta Copilot' : 'Vos'}</span>
        <div className="message-content">
          {message.result ? <ResultLine kind={message.result.kind} /> : null}
          <Markdown>{message.content}</Markdown>
          {message.role === 'assistant' && onPickTime ? (
            <TimeChips text={message.content} onPick={onPickTime} disabled={timeDisabled} />
          ) : null}
          {message.pending ? <p className="muted small">Enviando…</p> : null}
          {message.result?.sources.map((source) => (
            <details key={source.id}>
              <summary>Fuente recuperada: {source.title}</summary>
              <p>{source.content}</p>
            </details>
          ))}
        </div>
      </div>
    </article>
  );
}

export function CopilotArea() {
  const { userId, selection } = useAppContext();
  const tenantId = selection?.tenantId ?? '';
  const branchId = selection?.branchId ?? '';
  const conversationKey = `denta-conversation-${userId}-${tenantId}-${branchId}`;
  const draftKey = `denta-draft-${userId}-${tenantId}-${branchId}`;
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [catalog, setCatalog] = useState<Catalog>({ doctors: [], services: [] });
  const [insights, setInsights] = useState<DailyInsights | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [proposalBusy, setProposalBusy] = useState(false);
  const [pendingUser, setPendingUser] = useState<{ id: string; content: string } | null>(null);
  const [dictation, setDictation] = useState<{ phase: DictationPhase; level: number }>({ phase: 'idle', level: 0 });
  const [successTick, setSuccessTick] = useState(false);
  const chat = useChatRequest();
  const busy = chat.busy || proposalBusy;
  const bottom = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const audioActiveRef = useRef(false);
  const confirmedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const storedConversation = useCallback(() => {
    try {
      return window.localStorage.getItem(conversationKey) ?? '';
    } catch {
      return '';
    }
  }, [conversationKey]);

  const load = useCallback(async () => {
    const conversationId = storedConversation();
    const query = `?tenantId=${tenantId}&branchId=${branchId}${conversationId ? `&conversationId=${conversationId}` : ''}`;
    try {
      const data = await fetchJson(`/api/conversation${query}`);
      setMessages((data.messages ?? []) as ChatEntry[]);
      setProposals((data.proposals ?? []) as Proposal[]);
      setInsights((data.insights ?? null) as DailyInsights | null);
      setCatalog({
        doctors: (data.doctors ?? []) as Catalog['doctors'],
        services: (data.services ?? []) as Catalog['services'],
      });
      try {
        setDraft(window.localStorage.getItem(draftKey) ?? '');
      } catch {
        setDraft('');
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [tenantId, branchId, draftKey, storedConversation]);

  // Initial synchronization with the authorized conversation endpoint.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    try {
      if (draft) window.localStorage.setItem(draftKey, draft);
      else window.localStorage.removeItem(draftKey);
    } catch {
      // Draft persistence is best-effort and scoped to this user and branch.
    }
  }, [draft, draftKey]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, proposals.length, busy, chat.progress?.id, pendingUser]);

  useEffect(
    () => () => {
      if (confirmedTimer.current) clearTimeout(confirmedTimer.current);
    },
    [],
  );

  const celebrate = useCallback(() => {
    setSuccessTick(true);
    if (confirmedTimer.current) clearTimeout(confirmedTimer.current);
    confirmedTimer.current = setTimeout(() => setSuccessTick(false), 2500);
  }, []);

  const presence: DentaPresence = successTick
    ? 'exito'
    : busy
      ? 'consulta'
      : dictation.phase === 'recording'
        ? 'escucha'
        : dictation.phase === 'transcribing' || dictation.phase === 'stopping'
          ? 'transcribe'
          : 'reposo';

  const applyDelta = useCallback((delta: ChatDelta) => {
    setMessages((current) => applyChatDelta({ messages: current, proposals: [], appointments: [], audit: [] }, delta).messages);
    setProposals((current) =>
      applyChatDelta({ messages: [], proposals: current, appointments: [], audit: [] }, delta).proposals);
    if (delta.conversationId) {
      try {
        window.localStorage.setItem(conversationKey, delta.conversationId);
      } catch {
        // Best effort; the next turn opens a new conversation.
      }
    }
  }, [conversationKey]);

  async function sendText(text: string) {
    if (!text.trim() || busy || audioActiveRef.current) return;
    setError('');
    chat.clearStatus();
    setPendingUser({ id: `pending-${Date.now()}`, content: text });
    const conversationId = storedConversation();
    const data = await chat.send(text, {
      tenantId,
      branchId,
      conversationId: conversationId || undefined,
    });
    setPendingUser(null);
    if (!data) {
      textarea.current?.focus();
      return;
    }
    applyDelta(data);
    setDraft('');
    textarea.current?.focus();
  }

  async function send() {
    if (!draft.trim()) return;
    await sendText(draft.trim());
  }

  async function onDecide(id: string, approved: boolean) {
    if (busy || audioActiveRef.current) return;
    setProposalBusy(true);
    setError('');
    try {
      const data = await fetchJson('/api/proposals', { id, approved, tenantId, branchId });
      const delta = data as unknown as ChatDelta & { receipt?: unknown };
      applyDelta(delta);
      const updated = delta.proposals.find((p) => p.id === id);
      if (updated?.status === 'confirmed') celebrate();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProposalBusy(false);
    }
  }

  return (
    <>
      <div className="chat-heading">
        <DentaAvatar busy={busy} presence={presence} level={dictation.level} />
        <div>
          <h1>Denta, tu copiloto de recepción</h1>
          <p>
            <span className="status-dot" />
            {selection ? `${selection.tenantName} · ${selection.branchName}` : 'Sin sede'}
          </p>
        </div>
      </div>
      <div className="conversation" aria-live="polite" aria-busy={busy}>
        {!messages.length && !pendingUser ? (
          <div className="welcome">
            <span className="welcome-kicker">
              <Sparkles size={14} />
              MENOS GESTIÓN. MÁS ATENCIÓN.
            </span>
            <h2>
              Un nuevo día.
              <br />
              <span>Tu recepción, bajo control.</span>
            </h2>
            <p>Consultá la agenda, encontrá el mejor espacio y gestioná citas. Vos tenés la última palabra.</p>
            <div className="trust-line">
              <CheckCheck size={15} />
              Cada cambio empieza con una propuesta que vos confirmás.
            </div>
            <BriefingCards
              insights={insights}
              doctors={catalog.doctors}
              services={catalog.services}
              disabled={busy}
              onAction={(prompt) => void sendText(prompt)}
            />
          </div>
        ) : (
          <div className="messages">
            {messages.map((message) => (
              <MessageArticle
                key={message.id}
                message={message}
                timeDisabled={busy}
                onPickTime={(time) => {
                  setDraft(`¿Me preparás la propuesta para el espacio de las ${time}?`);
                  textarea.current?.focus();
                }}
              />
            ))}
            {pendingUser ? (
              <MessageArticle
                message={{ id: pendingUser.id, role: 'user', content: pendingUser.content, pending: true }}
              />
            ) : null}
            <ProposalList
              proposals={proposals}
              busy={busy}
              onDecide={onDecide}
              doctors={catalog.doctors}
              services={catalog.services}
            />
          </div>
        )}
        <ChatProgress busy={busy} progress={chat.progress} onCancel={chat.cancel} />
        <div ref={bottom} />
      </div>
      <div className="composer-area">
        {error || chat.error ? (
          <div className="error-message" role="alert">
            {error || chat.error}
          </div>
        ) : null}
        {chat.cancelled && !chat.busy ? (
          <div className="error-message" role="status">
            Solicitud cancelada. No se aplicaron cambios.
            <button onClick={chat.clearStatus}>Descartar aviso</button>
          </div>
        ) : null}
        <ChatComposer
          draft={draft}
          onDraftChange={setDraft}
          onSend={() => void send()}
          disabled={busy}
          busy={busy}
          onActivityChange={(active) => {
            audioActiveRef.current = active;
          }}
          onPresence={setDictation}
          textareaRef={textarea}
        />
      </div>
    </>
  );
}
