import { describe, expect, it } from 'vitest';
import { decide, propose, seedWorkspace } from './agenda';
import { executionReceipt, proposalSummary, verifyResult } from './results';

const now = new Date('2026-10-27T07:00:00-06:00');
const change = {
  action: 'book' as const,
  patient: 'Persona demo',
  doctorId: 'valeria',
  serviceId: 'evaluation',
  date: '2026-10-28',
  time: '11:00',
};
describe('contrato verificable', () => {
  it('resuelve propuestas y reemplaza una afirmación falsa de ejecución', () => {
    const state = seedWorkspace();
    const proposal = propose(state, change, now);
    const result = verifyResult(
      { kind: 'proposal', text: 'Ya quedó agendada', sourceIds: [], proposalIds: [proposal.id] },
      state,
      new Map(),
      new Set([proposal.id]),
    );
    expect(result.text).not.toContain('Ya quedó agendada');
    expect(result.text).toBe(
      'Preparé esta propuesta: Reservar valoración para Persona demo con Dra. Valeria Soto, mié 28 oct a las 11:00.\n\nTodavía no cambió nada: confirmá en la tarjeta para aplicarlo.',
    );
    expect(result.execution).toBe('none');
    expect(result.proposals[0].change).toEqual(change);
    expect(state.appointments).toHaveLength(3);
    expect(executionReceipt(state, proposal.id)).toBeNull();
  });
  it('rechaza executed, fuentes ajenas y propuestas omitidas o ajenas', () => {
    const state = seedWorkspace();
    const p = propose(state, change, now);
    const answer = { kind: 'answer', text: 'Respuesta', sourceIds: [], proposalIds: [] };
    for (const raw of [
      { ...answer, kind: 'executed' },
      { ...answer, sourceIds: ['inventada'] },
      { ...answer, kind: 'proposal', proposalIds: [p.id] },
    ]) {
      expect(() => verifyResult(raw, state, new Map(), new Set())).toThrow();
    }
    expect(() => verifyResult(answer, state, new Map(), new Set([p.id]))).toThrow();
  });
  it('emite un comprobante idempotente que conserva el estado al ejecutar', () => {
    const state = seedWorkspace();
    const p = propose(state, change, now);
    decide(state, p.id, true, now);
    const receipt = executionReceipt(state, p.id);
    decide(state, p.id, true, now);
    expect(executionReceipt(state, p.id)).toEqual(receipt);
    const cancellation = propose(
      state,
      { ...change, action: 'cancel', appointmentId: p.resultId },
      now,
    );
    decide(state, cancellation.id, true, now);
    expect(executionReceipt(state, p.id)?.appointment.status).toBe('scheduled');
    expect(executionReceipt(state, cancellation.id)?.appointment.status).toBe('cancelled');
    expect(state.audit).toHaveLength(2);
  });
  it('el resumen de reagendar y cancelar sale de los datos del servidor', () => {
    const state = seedWorkspace('2026-10-27');
    const move = propose(state, { ...change, action: 'reschedule', appointmentId: 'demo-ana', patient: 'x', serviceId: 'cleaning', time: '13:00' }, now);
    const cancel = propose(state, { ...change, action: 'cancel', appointmentId: 'demo-luis' }, now);
    const text = proposalSummary([move, cancel], state);
    expect(text).toContain('Preparé 2 propuestas:');
    expect(text).toContain('- Mover la limpieza dental de Ana Mora del mar 27 oct a las 09:00 al mié 28 oct a las 13:00 (Dra. Valeria Soto).');
    expect(text).toContain('- Cancelar la valoración de Luis Solís del mar 27 oct a las 10:30 (Dr. Andrés Vega).');
  });
});
