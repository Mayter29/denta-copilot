import type { Appointment, ChatEntry, Proposal, Workspace } from './types';

export type AuditEntry = Workspace['audit'][number];

/** Monotonic timing summary attached to a verified turn. Numbers only, no content. */
export type TurnTiming = {
  totalMs: number;
  steps: number;
  modelCalls: number;
  inputTokens?: number;
  outputTokens?: number;
  phases: Record<string, number>;
};

/** Incremental verified result of a turn or a decision: only what changed. */
export type ChatDelta = {
  /** New messages of this turn/decision, chronological. Client appends by id. */
  messages: ChatEntry[];
  /** Created or status-changed proposals. Client upserts by id. */
  proposals: Proposal[];
  /** Created or changed appointments. Client upserts by id. */
  appointments: Appointment[];
  /** New audit entries. Client appends by id. */
  audit: AuditEntry[];
  conversationId: string | null;
  terminal: 'published' | 'paused' | 'failed' | 'cancelled';
  timing?: TurnTiming;
};

export type ConversationState = {
  messages: ChatEntry[];
  proposals: Proposal[];
  appointments: Appointment[];
  audit: AuditEntry[];
};

/** Merges a verified delta: appends new messages/audit, upserts proposals/appointments. */
export function applyChatDelta(state: ConversationState, delta: ChatDelta): ConversationState {
  const seenMessages = new Set(state.messages.map((m) => m.id));
  const messages = [...state.messages];
  for (const message of delta.messages) {
    const { pending: _pending, ...entry } = message;
    if (!seenMessages.has(entry.id)) {
      seenMessages.add(entry.id);
      messages.push(entry);
    }
  }
  const upsert = <T extends { id: string }>(current: T[], incoming: T[]) => {
    const index = new Map(current.map((item, position) => [item.id, position]));
    const next = [...current];
    for (const item of incoming) {
      const at = index.get(item.id);
      if (at === undefined) next.push(item);
      else next[at] = item;
    }
    return next;
  };
  const seenAudit = new Set(state.audit.map((a) => a.id));
  return {
    messages,
    proposals: upsert(state.proposals, delta.proposals),
    appointments: upsert(state.appointments, delta.appointments),
    audit: [...state.audit, ...delta.audit.filter((a) => !seenAudit.has(a.id))],
  };
}

/** Removes an optimistic message that the server never confirmed (cancel/error/stale). */
export function dropPendingMessage(messages: ChatEntry[], tempId: string): ChatEntry[] {
  return messages.filter((m) => m.id !== tempId);
}
