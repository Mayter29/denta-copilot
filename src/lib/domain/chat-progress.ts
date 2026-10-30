export type ChatProgressId = 'agenda' | 'availability' | 'knowledge' | 'proposal';
export type ChatProgress = { id: ChatProgressId; label: string };

export const CHAT_PROGRESS: Record<ChatProgressId, ChatProgress> = {
  agenda: { id: 'agenda', label: 'Consultando agenda' },
  availability: { id: 'availability', label: 'Buscando disponibilidad' },
  knowledge: { id: 'knowledge', label: 'Consultando información' },
  proposal: { id: 'proposal', label: 'Preparando propuesta' },
};

const byTool: Record<string, ChatProgressId> = {
  listAppointments: 'agenda',
  findAvailability: 'availability',
  searchKnowledge: 'knowledge',
  proposeBooking: 'proposal',
  proposeCancellation: 'proposal',
  proposeReschedule: 'proposal',
};

/** Map a real server tool call to user-visible progress. Null = no public activity. */
export function progressForTool(toolName: string): ChatProgress | null {
  const id = byTool[toolName];
  return id ? CHAT_PROGRESS[id] : null;
}
