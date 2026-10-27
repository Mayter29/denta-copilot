import { expect, it } from 'vitest';
import { seedWorkspace } from '../src/lib/domain/agenda';
import { runSecretary } from '../src/lib/server/agent';

// Expectations stay in the evaluator. They are never sent to the model.
const cases = [
  { id: 'missing-data', text: 'Quiero una cita para Marina Ficticia.', expected: 'needs_input' },
  {
    id: 'booking',
    text: 'Prepará una reserva para Marina Ficticia, valoración con la Dra. Valeria Soto el 28 de octubre de 2026 a las 11:00.',
    expected: 'proposal',
  },
  {
    id: 'knowledge',
    text: '¿Cuál es el horario de la clínica? Consultá las fuentes.',
    expected: 'answer',
  },
];
for (const scenario of cases) {
  it(`Meta real · ${scenario.id}`, async () => {
    const now = new Date('2026-10-27T07:00:00-06:00');
    const state = seedWorkspace('2026-10-27');
    const result = await runSecretary(state, scenario.text, {
      now,
      abortSignal: AbortSignal.timeout(55_000),
    });
    expect(result.kind).toBe(scenario.expected);
    expect(result.execution).toBe('none');
    expect(state.appointments).toHaveLength(3);
    expect(state.audit).toEqual([]);
    if (scenario.id === 'booking') {
      expect(result.proposals).toHaveLength(1);
      expect(result.proposals[0].change).toEqual({
        action: 'book',
        patient: 'Marina Ficticia',
        doctorId: 'valeria',
        serviceId: 'evaluation',
        date: '2026-10-28',
        time: '11:00',
      });
    } else expect(state.proposals).toEqual([]);
    if (scenario.id === 'knowledge')
      expect(result.sources.some((s) => s.id === 'hours')).toBe(true);
  }, 60_000);
}
