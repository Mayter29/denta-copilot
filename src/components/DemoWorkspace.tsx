'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import {
  ArrowUpRight,
  CalendarDays,
  CheckCheck,
  ChevronDown,
  Layers2,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { ChatEntry, Workspace } from '@/lib/domain/types';
import type { DailyInsights } from '@/lib/domain/insights';
import { applyChatDelta } from '@/lib/domain/chat-delta';
import { LOCAL_CATALOG, type AgendaCatalog } from '@/lib/domain/catalog';
import { AgendaPanel } from './AgendaPanel';
import { ProposalList } from './ProposalList';
import { BriefingCards } from './briefing/BriefingCards';
import { TimeChips } from './chat/TimeChips';
import { ResultLine } from './chat/ResultLine';
import { DentaryBrand } from './brand/DentaryBrand';
import { DentaMascot } from './brand/DentaMascot';
import { DentaAvatar } from './brand/DentaAvatar';
import { ChatComposer } from './chat/ChatComposer';
import { ChatProgress } from './chat/ChatProgress';
import { useChatRequest } from './chat/useChatRequest';
import type { DentaPresence } from './brand/DentaAvatar';
import type { DictationPhase } from './chat/useDictation';

type View = Workspace & {
  today: string;
  modelReady: boolean;
  catalog?: AgendaCatalog | null;
  conversationId?: string | null;
  connected?: boolean;
  insights?: DailyInsights | null;
};
const suggestions = [
  {
    icon: CalendarDays,
    title: 'Encontrar un espacio',
    text: '¿Qué espacios tiene la Dra. Valeria mañana para una limpieza?',
  },
  {
    icon: Layers2,
    title: 'Gestionar una cita',
    text: 'Quiero reagendar la cita de Ana Mora. Mostrame primero su cita actual.',
  },
  {
    icon: ShieldCheck,
    title: 'Conocer la clínica',
    text: '¿Cuál es el horario y cuánto cuesta una valoración? Citá tus fuentes.',
  },
];
async function fetchJson(url: string, body?: unknown) {
  const response = await fetch(
    url,
    body
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : { cache: 'no-store' },
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'No se pudo completar la solicitud.');
  return data;
}
type NavSection = 'copilot' | 'agenda' | 'knowledge';
const navItems: { id: NavSection; label: string; icon: typeof MessageSquare }[] = [
  { id: 'copilot', label: 'Copiloto', icon: MessageSquare },
  { id: 'agenda', label: 'Agenda', icon: CalendarDays },
  { id: 'knowledge', label: 'Conocimiento', icon: Layers2 },
];
export function DemoWorkspace() {
  const [state, setState] = useState<View | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [proposalBusy, setProposalBusy] = useState(false);
  const chat = useChatRequest();
  const busy = chat.busy || proposalBusy;
  const [date, setDate] = useState('');
  const [tab, setTab] = useState('agenda');
  const [contextOpen, setContextOpen] = useState(false);
  // Sidebar highlight: the section the person chose, not every programmatic panel switch.
  const [section, setSection] = useState<NavSection>('copilot');
  const bottom = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [audioActive, setAudioActive] = useState(false);
  const audioActiveRef = useRef(false);
  const [dictation, setDictation] = useState<{ phase: DictationPhase; level: number }>({
    phase: 'idle',
    level: 0,
  });
  const [successTick, setSuccessTick] = useState(false);
  const onAudioActivity = useCallback((active: boolean) => {
    audioActiveRef.current = active;
    setAudioActive(active);
  }, []);
  const load = useCallback(async () => {
    try {
      const data = (await fetchJson('/api/workspace')) as View;
      setState(data);
      setContextOpen(window.matchMedia('(min-width: 931px)').matches);
      setDate((d) => d || data.today);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  // Initial synchronization with the local server; updates occur after fetch completes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [state?.messages.length, state?.proposals.length, busy, chat.progress?.id]);
  const confirmedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (confirmedTimer.current) clearTimeout(confirmedTimer.current);
  }, []);
  function celebrate() {
    setSuccessTick(true);
    if (confirmedTimer.current) clearTimeout(confirmedTimer.current);
    confirmedTimer.current = setTimeout(() => setSuccessTick(false), 2500);
  }
  const presence: DentaPresence = successTick
    ? 'exito'
    : busy
      ? 'consulta'
      : dictation.phase === 'recording'
        ? 'escucha'
        : dictation.phase === 'transcribing' || dictation.phase === 'stopping'
          ? 'transcribe'
          : 'reposo';
  const [pendingUser, setPendingUser] = useState<{ id: string; content: string } | null>(null);
  const [replyBusy, setReplyBusy] = useState<string | null>(null);
  async function sendText(text: string) {
    if (!text.trim() || busy || audioActiveRef.current || !state) return;
    setError('');
    chat.clearStatus();
    // Immediate visual answer: the user's own message, marked pending until verified.
    setPendingUser({ id: `pending-${Date.now()}`, content: text });
    const data = await chat.send(text);
    // Stale or cancelled responses return null and must not touch the UI.
    setPendingUser(null);
    if (!data) {
      textarea.current?.focus();
      return;
    }
    setState((s) => (s ? { ...s, ...applyChatDelta(s, data) } : s));
    setDraft('');
    textarea.current?.focus();
  }
  async function send() {
    if (!draft.trim()) return;
    await sendText(draft.trim());
  }
  async function onPatientReply(appointmentId: string, reply: 'confirm' | 'reschedule' | 'cancel') {
    if (busy || audioActiveRef.current || replyBusy) return;
    setReplyBusy(appointmentId);
    setError('');
    try {
      const data = await fetchJson('/api/patient-reply', { appointmentId, reply });
      setState((s) =>
        s
          ? {
              ...s,
              appointments: (data.appointments as View['appointments']).length
                ? s.appointments.map((a) =>
                    (data.appointments as View['appointments']).some((u) => u.id === a.id)
                      ? (data.appointments as View['appointments']).find((u) => u.id === a.id)!
                      : a,
                  )
                : s.appointments,
              patientThread: data.patientThread as View['patientThread'],
              audit: data.audit as View['audit'],
            }
          : s,
      );
      setTab('patients');
      setContextOpen(true);
      const summary = data.summary as string;
      const patient = state?.appointments.find((a) => a.id === appointmentId)?.patient ?? 'El paciente';
      await sendText(
        `${patient} respondió por el canal simulado: ${summary} Resumilo en una línea y decime qué sigue.`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setReplyBusy(null);
    }
  }
  async function onDecide(id: string, approved: boolean) {
    if (busy || audioActiveRef.current) return;
    setProposalBusy(true);
    setError('');
    try {
      const data = await fetchJson('/api/proposals', { id, approved });
      setState((s) => (s ? { ...s, ...data } : s));
      const updated = data.proposals.find((p: { id: string }) => p.id === id);
      if (updated?.status === 'confirmed') {
        setDate(updated.change.date);
        setTab(updated.change.action === 'follow_up' ? 'patients' : 'agenda');
        setContextOpen(true);
        celebrate();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProposalBusy(false);
    }
  }
  async function onDecideBatch(batchId: string, approved: boolean) {
    if (busy || audioActiveRef.current) return;
    setProposalBusy(true);
    setError('');
    try {
      const data = await fetchJson('/api/proposals', { batchId, approved });
      setState((s) => (s ? { ...s, ...data } : s));
      const batch = data.batch as { confirmed: string[]; failed: { id: string; error: string }[] };
      if (batch.failed.length)
        setError(
          `Lote parcial: ${batch.confirmed.length} aplicada(s), ${batch.failed.length} con problema (${batch.failed[0].error}).`,
        );
      else if (batch.confirmed.length) {
        const first = (data.proposals as { id: string; change: { date: string } }[]).find(
          (p) => p.id === batch.confirmed[0],
        );
        if (first) setDate(first.change.date);
        setTab('agenda');
        setContextOpen(true);
        celebrate();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProposalBusy(false);
    }
  }
  const catalog = state?.catalog ?? LOCAL_CATALOG;
  // Each card renders under the message that created it, with its live status.
  const liveProposals = new Map((state?.proposals ?? []).map((p) => [p.id, p]));
  const proposalsOf = (message: ChatEntry) =>
    (message.result?.proposals ?? []).flatMap((p) => liveProposals.get(p.id) ?? []);
  const linkedIds = new Set(state?.messages.flatMap((m) => proposalsOf(m).map((p) => p.id)));
  const proposalListProps = {
    busy: busy || audioActive,
    onDecide,
    onDecideBatch,
    doctors: catalog.doctors,
    services: catalog.services,
    appointments: state?.appointments,
  };
  function choose(text: string) {
    if (busy || audioActiveRef.current) return;
    setDraft(text);
    textarea.current?.focus();
  }
  return (
    <div className={`app-shell ${contextOpen ? '' : 'context-hidden'}`}>
      <nav className="sidebar" aria-label="Navegación principal">
        <DentaryBrand placement="sidebar" />
        <div className="workspace-switch">
          <div className="clinic-avatar">B</div>
          <div>
            <strong>Brisa Dental</strong>
            <span>Clínica de demostración</span>
          </div>
          <ChevronDown size={14} />
        </div>
        <span className="nav-label">ESPACIO DE TRABAJO</span>
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`nav-item${section === id ? ' active' : ''}`}
            aria-current={section === id ? 'true' : undefined}
            onClick={() => {
              setSection(id);
              if (id === 'copilot') {
                textarea.current?.focus();
                return;
              }
              setContextOpen(true);
              setTab(id);
            }}
          >
            <Icon size={18} />
            {label}
            {id === 'copilot' ? <span className="tiny-badge">AI</span> : null}
          </button>
        ))}
        <div className="sidebar-bottom">
          <div className="build-card">
            <Zap size={19} />
            <strong>De conversar a resolver.</strong>
            <p>Un copiloto que conecta el contexto de tu clínica con acciones concretas.</p>
            <span>
              Meta Hackathon 2026 <ArrowUpRight size={13} />
            </span>
          </div>
          <div className="user-profile">
            <div className="user-avatar">M</div>
            <div>
              <strong>Mi espacio de prueba</strong>
              <span>Demostración local · datos ficticios</span>
            </div>
          </div>
        </div>
      </nav>
      <main className="main">
        <header className="topbar">
          <DentaryBrand placement="header" />
          <div className="topbar-actions">
            <span className="demo-badge">DEMO</span>
            <button
              className="icon-button"
              title={contextOpen ? 'Ocultar contexto' : 'Mostrar contexto'}
              aria-label={contextOpen ? 'Ocultar contexto' : 'Mostrar contexto'}
              onClick={() => {
                // Hiding the panel returns the highlight to the chat.
                if (contextOpen) setSection('copilot');
                setContextOpen(!contextOpen);
              }}
            >
              {contextOpen ? <PanelRightClose size={19} /> : <PanelRightOpen size={19} />}
            </button>
          </div>
        </header>
        <div className="chat-heading">
          <DentaAvatar busy={busy} presence={presence} level={dictation.level} />
          <div>
            <h1>Denta, tu copiloto de recepción</h1>
            <p>
              <span className="status-dot" />
              {state?.modelReady
                ? 'Meta conectado · Listo para ayudarte'
                : 'Preparando conexión con Meta'}
            </p>
          </div>
        </div>
        <div className="conversation" aria-live="polite" aria-busy={busy}>
          {!state?.messages.length && !pendingUser ? (
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
              <p>
                Consultá la agenda, encontrá el mejor espacio y gestioná citas.
                <br className="desktop-break" /> Yo conecto los puntos. Vos tenés la última palabra.
              </p>
              <div className="suggestions">
                {suggestions.map(({ icon: Icon, title, text }) => (
                  <button key={title} onClick={() => choose(text)}>
                    <Icon size={20} />
                    <strong>{title}</strong>
                    <span>{text}</span>
                    <ArrowUpRight size={15} />
                  </button>
                ))}
              </div>
              <div className="trust-line">
                <CheckCheck size={15} />
                Cada cambio empieza con una propuesta que vos confirmás.
              </div>
              <BriefingCards
                insights={state?.insights}
                doctors={catalog.doctors}
                services={catalog.services}
                disabled={busy || !state}
                onAction={(prompt) => void sendText(prompt)}
              />
            </div>
          ) : (
            <div className="messages">
              {state?.messages.map((message) => (
                <article key={message.id} className={`message ${message.role}`}>
                  <div className="message-avatar">
                    {message.role === 'assistant' ? (
                      <DentaMascot size={29} blink={false} interactive={false} paused />
                    ) : (
                      'M'
                    )}
                  </div>
                  <div>
                    <span className="message-author">
                      {message.role === 'assistant' ? 'Denta Copilot' : 'Vos'}
                    </span>
                    <div className="message-content">
                      {message.result ? <ResultLine kind={message.result.kind} /> : null}
                      <Markdown>{message.content}</Markdown>
                      {message.role === 'assistant' ? (
                        <TimeChips
                          text={message.content}
                          disabled={busy || audioActive}
                          onPick={(time) => choose(`¿Me preparás la propuesta para el espacio de las ${time}?`)}
                        />
                      ) : null}
                      {message.result?.sources.map((source) => (
                        <details key={source.id}>
                          <summary>Fuente recuperada: {source.title}</summary>
                          <p>{source.content}</p>
                        </details>
                      ))}
                    </div>
                    <ProposalList proposals={proposalsOf(message)} {...proposalListProps} />
                  </div>
                </article>
              ))}
              {pendingUser ? (
                <article key={pendingUser.id} className="message user" aria-label="Mensaje enviando">
                  <div className="message-avatar">M</div>
                  <div>
                    <span className="message-author">Vos</span>
                    <div className="message-content">
                      <Markdown>{pendingUser.content}</Markdown>
                      <p className="muted small">Enviando…</p>
                    </div>
                  </div>
                </article>
              ) : null}
              <ProposalList
                proposals={(state?.proposals ?? []).filter((p) => !linkedIds.has(p.id))}
                {...proposalListProps}
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
              {!state ? <button onClick={() => void load()}>Reintentar conexión</button> : null}
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
            onSend={() => {
              void send();
            }}
            disabled={busy || !state}
            busy={busy}
            onActivityChange={onAudioActivity}
            onPresence={setDictation}
            textareaRef={textarea}
          />
        </div>
      </main>
      {contextOpen && state ? (
        <AgendaPanel
          state={state}
          date={date}
          onDate={setDate}
          tab={tab}
          onTab={(next) => {
            setTab(next);
            setSection(next === 'agenda' || next === 'knowledge' ? next : 'copilot');
          }}
          catalog={catalog}
          onPatientReply={(appointmentId, reply) => void onPatientReply(appointmentId, reply)}
          replyBusy={replyBusy}
        />
      ) : null}
    </div>
  );
}
