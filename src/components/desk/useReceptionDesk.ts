'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Workspace } from '@/lib/domain/types';
import type { DeskPanel } from '../shell/WorkspaceSidebar';

type View = Workspace & { today: string; modelReady: boolean };

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
  const data = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
  return data as View;
}

function readError(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

export function useReceptionDesk() {
  const [state, setState] = useState<View | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState('');
  const [panel, setPanel] = useState<DeskPanel>('overview');
  const [contextOpen, setContextOpen] = useState(true);
  const bottom = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const inFlight = useRef(false);
  const [audioActive, setAudioActive] = useState(false);
  const audioActiveRef = useRef(false);
  const onAudioActivity = useCallback((active: boolean) => {
    audioActiveRef.current = active;
    setAudioActive(active);
  }, []);
  const blocked = () => inFlight.current || audioActiveRef.current;
  const load = useCallback(async () => {
    try {
      const data = await fetchJson('/api/workspace');
      setState(data);
      setContextOpen(window.matchMedia('(min-width: 931px)').matches);
      setDate((current) => current || data.today);
      setError('');
    } catch (cause) {
      setError(readError(cause, 'The desk could not be loaded.'));
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [state?.messages.length, state?.proposals.length, busy]);
  async function send() {
    if (!draft.trim() || blocked() || !state) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      const data = await fetchJson('/api/chat', { text: draft.trim() });
      setState((current) => (current ? { ...current, ...data } : current));
      setDraft('');
    } catch (cause) {
      setError(readError(cause, 'The message could not be sent.'));
    } finally {
      inFlight.current = false;
      setBusy(false);
      textarea.current?.focus();
    }
  }
  async function onDecide(id: string, approved: boolean) {
    if (blocked()) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      const data = await fetchJson('/api/proposals', { id, approved });
      setState((current) => (current ? { ...current, ...data } : current));
      const updated = data.proposals?.find((proposal) => proposal.id === id);
      if (updated?.status !== 'confirmed') return;
      setDate(updated.change.date);
      setPanel(updated.change.action === 'follow_up' ? 'patients' : 'schedule');
      setContextOpen(true);
    } catch (cause) {
      setError(readError(cause, 'The decision could not be saved.'));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  function openPanel(next: DeskPanel) {
    setPanel(next);
    setContextOpen(true);
    if (next === 'overview') textarea.current?.focus();
  }
  function choose(text: string) {
    if (blocked()) return;
    setDraft(text);
    textarea.current?.focus();
  }
  const followUps =
    state?.appointments.filter(
      (appointment) => appointment.status === 'scheduled' && appointment.attendance !== 'confirmed',
    ).length ?? 0;
  return {
    state,
    draft,
    setDraft,
    error,
    busy: busy || audioActive,
    sending: busy,
    date,
    setDate,
    panel,
    contextOpen,
    setContextOpen,
    bottom,
    textarea,
    onAudioActivity,
    load,
    send,
    onDecide,
    openPanel,
    choose,
    followUps,
    shellClass: `app-shell ${contextOpen ? '' : 'context-hidden'} ${panel === 'overview' ? 'mobile-chat' : 'mobile-context'}`,
  };
}
