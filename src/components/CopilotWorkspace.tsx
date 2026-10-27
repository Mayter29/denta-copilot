'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Markdown from 'react-markdown';
import Link from 'next/link';
import {
  ArrowUp,
  AudioLines,
  ArrowUpRight,
  CalendarDays,
  CheckCheck,
  ChevronDown,
  Command,
  Layers2,
  LoaderCircle,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Zap,
} from 'lucide-react';
import type { Workspace } from '@/lib/domain/types';
import { AgendaPanel } from './AgendaPanel';
import { ProposalCard } from './ProposalCard';

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
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState('');
  const [tab, setTab] = useState('agenda');
  const [contextOpen, setContextOpen] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const inFlight = useRef(false);
  const audioInput = useRef<HTMLInputElement>(null);
  const [transcribing, setTranscribing] = useState(false);
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
  }, [state?.messages.length, state?.proposals.length, busy]);
  async function send(event?: FormEvent) {
    event?.preventDefault();
    if (!draft.trim() || inFlight.current || !state) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    const text = draft.trim();
    try {
      const data = await fetchJson('/api/chat', { text });
      setState((s) => (s ? { ...s, ...data } : s));
      setDraft('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      inFlight.current = false;
      setBusy(false);
      textarea.current?.focus();
    }
  }
  async function onDecide(id: string, approved: boolean) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
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
      inFlight.current = false;
      setBusy(false);
    }
  }
  function choose(text: string) {
    setDraft(text);
    textarea.current?.focus();
  }
  async function transcribe(file?: File) {
    if (!file || inFlight.current) return;
    if (file.size > 2_000_000) {
      setError('Usá un audio WAV mono de hasta 60 segundos y 2 MB.');
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setTranscribing(true);
    setError('');
    try {
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'audio/wav' },
        body: file,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo transcribir el audio.');
      setDraft((previous) => [previous, data.text].filter(Boolean).join('\n').slice(0, 2000));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      inFlight.current = false;
      setBusy(false);
      setTranscribing(false);
      if (audioInput.current) audioInput.current.value = '';
      textarea.current?.focus();
    }
  }
  return (
    <div className={`app-shell ${contextOpen ? '' : 'context-hidden'}`}>
      <nav className="sidebar" aria-label="Navegación principal">
        <Link className="brand" href="/" aria-label="Denta Copilot, inicio">
          <div className="brand-symbol">
            <Stethoscope size={23} />
          </div>
          <div>
            Denta<span>copilot</span>
          </div>
        </Link>
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
          <div className="breadcrumbs">
            Espacio de trabajo <span>/</span>
            <strong>Copiloto</strong>
          </div>
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
          <div className="copilot-avatar">
            <Sparkles size={22} />
          </div>
          <div>
            <h1>Tu copiloto de recepción</h1>
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
                    {message.role === 'assistant' ? <Sparkles size={17} /> : 'M'}
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
                <ProposalCard key={p.id} proposal={p} busy={busy} onDecide={onDecide} />
              ))}
            </div>
          )}
          {busy ? (
            <div className="thinking" role="status">
              <LoaderCircle size={17} className="spinner" />
              {transcribing
                ? 'Transcribiendo audio con Meta…'
                : 'Consultando contexto y validando la agenda…'}
            </div>
          ) : null}
          <div ref={bottom} />
        </div>
        <div className="composer-area">
          {error ? (
            <div className="error-message" role="alert">
              {error}
              {!state ? <button onClick={() => void load()}>Reintentar conexión</button> : null}
            </div>
          ) : null}
          <form
            className={`composer${busy ? ' composer-busy' : ''}`}
            onSubmit={send}
            aria-busy={busy}
          >
            <label htmlFor="chat-draft" className="sr-only">
              Mensaje al copiloto
            </label>
            <textarea
              ref={textarea}
              id="chat-draft"
              value={draft}
              maxLength={2000}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Preguntame algo o prepará una cita…"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <div className="composer-actions">
              <input
                ref={audioInput}
                type="file"
                accept="audio/wav,.wav"
                className="sr-only"
                aria-label="Seleccionar audio WAV ficticio"
                onChange={(e) => void transcribe(e.target.files?.[0])}
              />
              <button
                type="button"
                className="composer-audio"
                aria-label="Adjuntar audio WAV"
                title="Audio ficticio: WAV mono, 16 kHz, 16 bits, máximo 60 s. Se envía a Meta para transcribir a un borrador editable."
                disabled={busy || !state}
                onClick={() => audioInput.current?.click()}
              >
                {transcribing ? (
                  <LoaderCircle size={19} className="spinner" />
                ) : (
                  <AudioLines size={20} />
                )}
              </button>
              <button
                className="send-button"
                type="submit"
                aria-label="Enviar mensaje"
                disabled={busy || !draft.trim() || !state}
              >
                {busy ? <LoaderCircle size={19} className="spinner" /> : <ArrowUp size={20} />}
              </button>
            </div>
          </form>
          <div className="composer-hint">
            <span>
              <Command size={12} /> Enter para enviar · Shift + Enter para nueva línea
            </span>
            <span>Audio a borrador</span>
          </div>
          <p className="composer-disclaimer">
            <ShieldCheck size={12} />
            Solo datos ficticios. Revisá cada propuesta antes de confirmar.
          </p>
        </div>
      </main>
      {contextOpen && state ? (
        <AgendaPanel state={state} date={date} onDate={setDate} tab={tab} onTab={setTab} />
      ) : null}
    </div>
  );
}
