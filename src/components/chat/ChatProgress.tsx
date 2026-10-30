'use client';
import { LoaderCircle, X } from 'lucide-react';
import type { ChatProgress } from '@/lib/domain/chat-progress';

type Props = {
  busy: boolean;
  progress: ChatProgress | null;
  onCancel: () => void;
};

/** Real server activity only. No timers: labels arrive from tool events via SSE. */
export function ChatProgress({ busy, progress, onCancel }: Props) {
  if (!busy) return null;
  return (
    <div className="thinking" role="status" aria-live="polite" aria-atomic="true">
      <LoaderCircle size={17} className="spinner" aria-hidden="true" />
      <span>{progress ? `${progress.label}…` : 'Conectando con Denta…'}</span>
      <button
        type="button"
        className="secondary"
        onClick={onCancel}
        aria-label="Cancelar solicitud en curso"
      >
        <X size={14} aria-hidden="true" />
        Cancelar
      </button>
    </div>
  );
}
