'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Proposal, Workspace } from '@/lib/domain/types';

export type WorkspaceView = Workspace & { today: string; modelReady: boolean };

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
  return data;
}

export function useWorkspaceSession() {
  const [state, setState] = useState<WorkspaceView | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState('');
  const [audioActive, setAudioActive] = useState(false);
  const audioActiveRef = useRef(false);
  const inFlight = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const onAudioActivity = useCallback((active: boolean) => {
    audioActiveRef.current = active;
    setAudioActive(active);
  }, []);
  const load = useCallback(async () => {
    try {
      const data = (await fetchJson('/api/workspace')) as WorkspaceView;
      setState(data);
      setDate((current) => current || data.today);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The clinic could not be loaded.');
    }
  }, []);
  useEffect(() => {
    // Initial synchronization with the local server; updates arrive after fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  async function send() {
    if (!draft.trim() || inFlight.current || audioActiveRef.current || !state) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    const text = draft.trim();
    try {
      const data = await fetchJson('/api/chat', { text });
      setState((current) => (current ? { ...current, ...data } : current));
      setDraft('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The message could not be sent.');
    } finally {
      inFlight.current = false;
      setBusy(false);
      textareaRef.current?.focus();
    }
  }
  async function decide(id: string, approved: boolean) {
    if (inFlight.current || audioActiveRef.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      const data = (await fetchJson('/api/proposals', { id, approved })) as WorkspaceView & {
        proposals: Proposal[];
      };
      setState((current) => (current ? { ...current, ...data } : current));
      const updated = data.proposals.find((proposal) => proposal.id === id);
      if (updated?.status === 'confirmed') setDate(updated.change.date);
      return updated;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The decision could not be saved.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return {
    state,
    draft,
    setDraft,
    error,
    busy,
    date,
    setDate,
    audioActive,
    onAudioActivity,
    load,
    send,
    decide,
    textareaRef,
  };
}
