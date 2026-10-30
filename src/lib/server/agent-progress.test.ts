import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { propose, seedWorkspace } from '../domain/agenda';
import type { ChatProgress } from '../domain/chat-progress';
import type { Proposal } from '../domain/types';
import { runSecretary } from './agent';
import { scriptedModel, toolOutput, type ScriptStep } from './conversation-harness';

const now = new Date('2026-10-27T07:00:00-06:00');
const booking = {
  patient: 'Marina Ficticia',
  doctorId: 'valeria',
  serviceId: 'evaluation',
  date: '2026-10-28',
  time: '11:00',
};
const final = (
  kind: 'answer' | 'needs_input' | 'proposal',
  text = 'Información de demostración',
  sourceIds: string[] = [],
  proposalIds: string[] = [],
) => ({ toolName: 'submitResult', input: { kind, text, sourceIds, proposalIds } });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('progreso real del agente', () => {
  it('emite actividad correspondiente a las herramientas ejecutadas y final verificado', async () => {
    const state = seedWorkspace('2026-10-27');
    const seen: ChatProgress[] = [];
    const steps: ScriptStep[] = [
      { toolName: 'searchKnowledge', input: { query: 'horario' } },
      { toolName: 'findAvailability', input: { date: booking.date, doctorId: 'valeria', serviceId: 'evaluation' } },
      { toolName: 'proposeBooking', input: booking },
      (prompt) =>
        final('proposal', 'Ya agendé', [], [toolOutput<Proposal>(prompt, 'proposeBooking').id]),
    ];
    const result = await runSecretary(state, 'Reservá para Marina', {
      model: scriptedModel(steps),
      now,
      onProgress: (p) => seen.push(p),
    });
    expect(seen.map((p) => p.id)).toEqual(['model', 'knowledge', 'availability', 'proposal']);
    expect(seen.every((p) => typeof p.label === 'string' && p.label.length > 0)).toBe(true);
    expect(result.kind).toBe('proposal');
    expect(result.execution).toBe('none');
    expect(result.proposals).toHaveLength(1);
    expect(state.proposals[0].status).toBe('pending');
    expect(state.appointments).toHaveLength(3);
  });

  it('una propuesta termina pendiente y no modifica citas', async () => {
    const state = seedWorkspace('2026-10-27');
    const seen: ChatProgress[] = [];
    const result = await runSecretary(state, 'Reservá', {
      model: scriptedModel([
        { toolName: 'listAppointments', input: { patient: 'Ana' } },
        { toolName: 'proposeBooking', input: booking },
        (prompt) =>
          final('proposal', 'Pendiente', [], [toolOutput<Proposal>(prompt, 'proposeBooking').id]),
      ]),
      now,
      onProgress: (p) => seen.push(p),
    });
    expect(seen.map((p) => p.id)).toEqual(['model', 'agenda', 'proposal']);
    expect(result.kind).toBe('proposal');
    expect(state.appointments).toHaveLength(3);
    expect(state.audit).toEqual([]);
  });

  it('error no muestra éxito ni deja propuestas parciales', async () => {
    const state = seedWorkspace('2026-10-27');
    const seen: ChatProgress[] = [];
    const result = await runSecretary(state, 'Reservá', {
      model: scriptedModel([
        { toolName: 'proposeBooking', input: booking },
        (prompt) =>
          final('proposal', 'Listo', ['inventada'], [
            toolOutput<Proposal>(prompt, 'proposeBooking').id,
          ]),
      ]),
      now,
      onProgress: (p) => seen.push(p),
    });
    expect(result.kind).toBe('failed');
    expect(result.execution).toBe('none');
    expect(state.proposals).toEqual([]);
    expect(seen.map((p) => p.id)).toEqual(['model', 'proposal']);
  });

  it('límite de pasos termina pausado sin propuestas', async () => {
    const state = seedWorkspace('2026-10-27');
    const seen: ChatProgress[] = [];
    const steps: ScriptStep[] = Array.from({ length: 6 }, () => ({
      toolName: 'findAvailability',
      input: { date: booking.date, doctorId: 'valeria', serviceId: 'evaluation' },
    }));
    const result = await runSecretary(state, 'Buscá espacios', {
      model: scriptedModel(steps),
      now,
      onProgress: (p) => seen.push(p),
    });
    expect(result.kind).toBe('paused');
    expect(state.proposals).toEqual([]);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen[0].id).toBe('model');
    expect(seen.slice(1).every((p) => p.id === 'availability')).toBe(true);
  });

  it('cancelación aborta y marca el turno pausado sin escrituras', async () => {
    const state = seedWorkspace('2026-10-27');
    const controller = new AbortController();
    controller.abort();
    const seen: ChatProgress[] = [];
    const result = await runSecretary(state, 'Reservá', {
      model: scriptedModel([{ toolName: 'listAppointments', input: {} }]),
      now,
      abortSignal: controller.signal,
      onProgress: (p) => seen.push(p),
    });
    expect(['paused', 'failed']).toContain(result.kind);
    expect(result.execution).toBe('none');
    expect(state.proposals).toEqual([]);
    expect(state.appointments).toHaveLength(3);
  });

  it('ID ajeno no genera propuesta válida aunque el progreso se haya emitido', async () => {
    const foreign = seedWorkspace('2026-10-27');
    const other = propose(foreign, { action: 'book', ...booking }, now);
    const state = seedWorkspace('2026-10-27');
    const seen: ChatProgress[] = [];
    const result = await runSecretary(state, 'Confirmá', {
      model: scriptedModel([final('proposal', 'Listo', [], [other.id])]),
      now,
      onProgress: (p) => seen.push(p),
    });
    expect(result.kind).toBe('failed');
    expect(state.proposals).toEqual([]);
    expect(seen.map((p) => p.id)).toEqual(['model']);
  });
});
