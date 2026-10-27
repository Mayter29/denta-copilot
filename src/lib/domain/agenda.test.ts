import { describe, expect, it } from 'vitest';
import { availableSlots, decide, propose, seedWorkspace, validateSlot } from './agenda';
import type { Change } from './types';
const now = new Date('2026-10-27T07:00:00-06:00');
const change: Change = {
  action: 'book',
  patient: 'Persona ficticia',
  doctorId: 'valeria',
  serviceId: 'evaluation',
  date: '2026-10-28',
  time: '11:00',
};
describe('agenda administrativa', () => {
  it('proponer no escribe y confirmar aplica una sola vez', () => {
    const state = seedWorkspace();
    const p = propose(state, change, now);
    expect(state.appointments).toHaveLength(3);
    decide(state, p.id, true, now);
    decide(state, p.id, true, now);
    expect(state.appointments).toHaveLength(4);
    expect(state.audit).toHaveLength(1);
  });
  it('rechazar no escribe', () => {
    const s = seedWorkspace();
    const p = propose(s, change, now);
    decide(s, p.id, false, now);
    expect(s.appointments).toHaveLength(3);
    expect(p.status).toBe('rejected');
  });
  it('deduplica propuestas pendientes iguales', () => {
    const s = seedWorkspace();
    expect(propose(s, change, now).id).toBe(propose(s, change, now).id);
  });
  it('revalida conflictos cuando dos propuestas compiten', () => {
    const s = seedWorkspace();
    const a = propose(s, change, now);
    const b = propose(s, { ...change, patient: 'Otra persona' }, now);
    decide(s, a.id, true, now);
    expect(() => decide(s, b.id, true, now)).toThrow('ocupado');
    expect(s.audit).toHaveLength(1);
  });
  it('vence la propuesta a los diez minutos', () => {
    const s = seedWorkspace();
    const p = propose(s, change, now);
    decide(s, p.id, true, new Date(now.getTime() + 600_000));
    expect(p.status).toBe('expired');
    expect(s.audit).toHaveLength(0);
  });
  it('impide confirmar propuestas de otra sesión', () => {
    const a = seedWorkspace();
    const b = seedWorkspace();
    const p = propose(a, change, now);
    expect(() => decide(b, p.id, true, now)).toThrow('sesión');
  });
  it('cancela una cita existente y libera disponibilidad', () => {
    const s = seedWorkspace('2026-10-28');
    const p = propose(s, { ...change, action: 'cancel', appointmentId: 'demo-ana' }, now);
    expect(p.change.time).toBe('09:00');
    decide(s, p.id, true, now);
    expect(s.appointments[0].status).toBe('cancelled');
    expect(availableSlots(s, '2026-10-28', 'valeria', 'cleaning', now)).toContain('09:00');
  });
  it('reagenda conservando ID y detecta otra propuesta obsoleta', () => {
    const s = seedWorkspace('2026-10-28');
    const a = propose(s, { ...change, action: 'reschedule', appointmentId: 'demo-ana' }, now);
    const b = propose(s, { ...change, action: 'cancel', appointmentId: 'demo-ana' }, now);
    decide(s, a.id, true, now);
    expect(s.appointments[0].time).toBe('11:00');
    expect(s.appointments[0].version).toBe(2);
    expect(() => decide(s, b.id, true, now)).toThrow('cambió');
  });
  it('permite citas contiguas pero bloquea traslapes parciales', () => {
    const s = seedWorkspace('2026-10-28');
    expect(() => validateSlot(s, { ...change, time: '09:30' }, now)).toThrow('ocupado');
    expect(() => validateSlot(s, { ...change, time: '10:00' }, now)).not.toThrow();
  });
  it('separa profesionales', () => {
    const s = seedWorkspace('2026-10-28');
    expect(() =>
      validateSlot(s, { ...change, doctorId: 'andres', time: '09:00' }, now),
    ).not.toThrow();
  });
  it.each([
    { date: '2026-11-01', time: '11:00' },
    { date: '2026-10-31', time: '11:30', serviceId: 'cleaning' },
    { date: '2026-10-28', time: '16:30', serviceId: 'cleaning' },
    { date: '2026-10-28', time: '07:30' },
    { date: '2026-02-30', time: '11:00' },
    { date: '2026-10-26', time: '11:00' },
    { date: '2026-10-28', time: '25:00' },
  ])('rechaza horario/fecha inválidos: %o', (patch) => {
    expect(() => validateSlot(seedWorkspace(), { ...change, ...patch }, now)).toThrow();
  });
  it('bloquea IDs de profesional y servicio desconocidos', () => {
    expect(() => validateSlot(seedWorkspace(), { ...change, doctorId: 'intruso' }, now)).toThrow();
    expect(() =>
      validateSlot(seedWorkspace(), { ...change, serviceId: 'inventado' }, now),
    ).toThrow();
  });
});
