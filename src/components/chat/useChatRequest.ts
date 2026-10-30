'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatProgress } from '@/lib/domain/chat-progress';
import { sendChat, type ChatContext, type ChatFinalPayload } from '@/lib/client/chat';

export function useChatRequest() {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ChatProgress | null>(null);
  const [error, setError] = useState('');
  const [cancelled, setCancelled] = useState(false);
  const requestId = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const send = useCallback(
    async (text: string, context?: Omit<ChatContext, 'requestId'>): Promise<ChatFinalPayload | null> => {
      if (abortRef.current) return null;
      const id = ++requestId.current;
      const controller = new AbortController();
      abortRef.current = controller;
      if (mounted.current) {
        setBusy(true);
        setProgress(null);
        setError('');
        setCancelled(false);
      }
      try {
        const final = await sendChat(text, {
          signal: controller.signal,
          context: context ? { ...context, requestId: crypto.randomUUID() } : undefined,
          onProgress: (next) => {
          if (requestId.current !== id || controller.signal.aborted) return;
          // Avoid repetitive announcements of the same activity.
          setProgress((current) => (current?.id === next.id ? current : next));
        },
      });
      if (requestId.current !== id || controller.signal.aborted) return null;
      return final;
    } catch (e) {
      if (requestId.current !== id) return null;
      if ((e as Error).name === 'AbortError' || controller.signal.aborted) {
        if (mounted.current) setCancelled(true);
        return null;
      }
      if (mounted.current) setError((e as Error).message);
      return null;
    } finally {
      if (mounted.current) {
        setBusy(false);
        setProgress(null);
      }
      if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearStatus = useCallback(() => {
    setError('');
    setCancelled(false);
  }, []);

  return { busy, progress, error, cancelled, send, cancel, clearStatus };
}
