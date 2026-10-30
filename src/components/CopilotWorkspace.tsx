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
import type { Workspace } from '@/lib/domain/types';
import { AgendaPanel } from './AgendaPanel';
import { ProposalCard } from './ProposalCard';
import { DentaryBrand } from './brand/DentaryBrand';
import { DentaMascot } from './brand/DentaMascot';
import { DentaAvatar } from './brand/DentaAvatar';
import { ChatComposer } from './chat/ChatComposer';
import { ChatProgress } from './chat/ChatProgress';
import { useChatRequest } from './chat/useChatRequest';

type View = Workspace & { today: string; modelReady: boolean };
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
export function CopilotWorkspace() {
  const [state, setState] = useState<View | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [proposalBusy, setProposalBusy] = useState(false);
  const chat = useChatRequest();
  const busy = chat.busy || proposalBusy;
  const [date, setDate] = useState('');
  const [tab, setTab] = useState('agenda');
  const [contextOpen, setContextOpen] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [audioActive, setAudioActive] = useState(false);
  const audioActiveRef = useRef(false);
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
  async function send() {
    if (!draft.trim() || busy || audioActiveRef.current || !state) return;
    setError('');
    chat.clearStatus();
    const text = draft.trim();
    const data = await chat.send(text);
    // Stale or cancelled responses return null and must not touch the UI.
    if (!data) {
      textarea.current?.focus();
      return;
    }
    setState((s) => (s ? { ...s, ...data } : s));
    setDraft('');
    textarea.current?.focus();
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
        setTab('agenda');
        setContextOpen(true);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProposalBusy(false);
    }
  }
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
        <button className="nav-item active" onClick={() => textarea.current?.focus()}>
          <MessageSquare size={18} />
          Copiloto<span className="tiny-badge">AI</span>
        </button>
        <button
          className="nav-item"
          onClick={() => {
            setContextOpen(true);
            setTab('agenda');
          }}
        >
          <CalendarDays size={18} />
          Agenda
        </button>
        <button
          className="nav-item"
          onClick={() => {
            setContextOpen(true);
            setTab('knowledge');
          }}
        >
          <Layers2 size={18} />
          Conocimiento
        </button>
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
              <span>Sesión local · datos ficticios</span>
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
              onClick={() => setContextOpen((v) => !v)}
            >
              {contextOpen ? <PanelRightClose size={19} /> : <PanelRightOpen size={19} />}
            </button>
          </div>
        </header>
        <div className="chat-heading">
          <DentaAvatar busy={busy} />
          <div>
            <h1>Denta, tu copiloto de recepción</h1>
            <p>
              <span className="status-dot" />
              {state?.modelReady
                ? 'Meta conectado · Listo para ayudarte'
                : 'Preparando conexión con Meta'}
            </p>
          </div>
          <span className="model-pill">Muse Spark</span>
        </div>
        <div className="conversation" aria-live="polite" aria-busy={busy}>
          {!state?.messages.length ? (
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
            </div>
          ) : (
            <div className="messages">
              {state.messages.map((message) => (
                <article key={message.id} className={`message ${message.role}`}>
                  <div className="message-avatar">
                    {message.role === 'assistant' ? <DentaMascot size={29} blink={false} /> : 'M'}
                  </div>
                  <div>
                    <span className="message-author">
                      {message.role === 'assistant' ? 'Denta Copilot' : 'Vos'}
                    </span>
                    <div className="message-content">
                      {message.result ? (
                        <p>
                          <strong>
                            {message.result.kind === 'proposal'
                              ? 'Pendiente de confirmación'
                              : message.result.kind === 'needs_input'
                                ? 'Necesita información'
                                : message.result.kind === 'paused'
                                  ? 'Turno pausado'
                                  : message.result.kind === 'failed'
                                    ? 'Verificación fallida'
                                    : 'Respuesta informativa'}
                          </strong>{' '}
                          · Sin cambios de agenda en este turno
                        </p>
                      ) : null}
                      <Markdown>{message.content}</Markdown>
                      {message.result?.sources.map((source) => (
                        <details key={source.id}>
                          <summary>Fuente recuperada: {source.title}</summary>
                          <p>{source.content}</p>
                        </details>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
              {state.proposals.map((p) => (
                <ProposalCard
                  key={p.id}
                  proposal={p}
                  busy={busy || audioActive}
                  onDecide={onDecide}
                />
              ))}
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
            textareaRef={textarea}
          />
        </div>
      </main>
      {contextOpen && state ? (
        <AgendaPanel state={state} date={date} onDate={setDate} tab={tab} onTab={setTab} />
      ) : null}
    </div>
  );
}
