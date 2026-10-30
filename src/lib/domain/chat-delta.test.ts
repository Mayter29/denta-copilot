import { describe, expect, it } from 'vitest';
import { applyChatDelta, dropPendingMessage, type ChatDelta } from './chat-delta';
import type { Appointment, ChatEntry, Proposal } from './types';
import type { AuditEntry } from './chat-delta';

const user = (id: string, content: string): ChatEntry => ({ id, role: 'user', content });
const assistant = (id: string, content: string, kind: 'answer' = 'answer'): ChatEntry => ({
  id,
  role: 'assistant',
  content,
  result: { kind, text: content, execution: 'none', sources: [], proposals: [] },
});
const proposal = (id: string, status: Proposal['status'] = 'pending'): Proposal => ({
  id,
  change: { action: 'book', patient: 'Demo', doctorId: 'valeria', serviceId: 'evaluation', date: '2026-11-02', time: '11:00' },
  createdAt: 1,
  status,
});
const appointment = (id: string, version = 1): Appointment => ({
  id, patient: 'Demo', doctorId: 'valeria', serviceId: 'evaluation',
  date: '2026-11-02', time: '11:00', duration: 30, status: 'scheduled', version,
});
const audit = (id: string): AuditEntry => ({ id, action: 'book', at: '2026-11-01', appointmentId: 'a1' });

describe('fusión incremental del turno', () => {
  it('agrega mensajes y auditoría nuevos sin duplicar', () => {
    const state = { messages: [user('m1', 'Hola')], proposals: [], appointments: [], audit: [] };
    const delta: ChatDelta = {
      messages: [user('m1', 'Hola'), assistant('m2', 'Listo')],
      proposals: [], appointments: [], audit: [audit('a1')],
      conversationId: null, terminal: 'published',
    };
    const next = applyChatDelta(applyChatDelta(state, delta), delta);
    expect(next.messages.map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(next.audit.map((a) => a.id)).toEqual(['a1']);
  });
  it('actualiza propuestas y citas por id sin tocar el resto', () => {
    const state = {
      messages: [],
      proposals: [proposal('p1', 'pending')],
      appointments: [appointment('c1', 1)],
      audit: [],
    };
    const delta: ChatDelta = {
      messages: [], audit: [],
      proposals: [proposal('p1', 'confirmed'), proposal('p2', 'pending')],
      appointments: [appointment('c1', 2)],
      conversationId: 'conv', terminal: 'published',
    };
    const next = applyChatDelta(state, delta);
    expect(next.proposals.find((p) => p.id === 'p1')?.status).toBe('confirmed');
    expect(next.proposals).toHaveLength(2);
    expect(next.appointments.find((a) => a.id === 'c1')?.version).toBe(2);
  });
  it('descarta el mensaje optimista no confirmado y conserva el resto', () => {
    const messages = [user('m1', 'Hola'), { ...user('temp-1', 'Chau'), pending: true }];
    expect(dropPendingMessage(messages, 'temp-1').map((m) => m.id)).toEqual(['m1']);
    expect(dropPendingMessage(messages, 'otra').map((m) => m.id)).toEqual(['m1', 'temp-1']);
  });
});
