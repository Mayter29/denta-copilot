import { describe, expect, it } from 'vitest';
import {
  availableSlots,
  decide,
  hydrateWorkspace,
  propose,
  seedWorkspace,
  validateSlot,
} from './agenda';
import type { Change, Workspace } from './types';
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
  const followUp: Change = {
    action: 'follow_up',
    patient: 'alguien',
    appointmentId: 'demo-luis',
    doctorId: 'valeria',
    serviceId: 'cleaning',
    date: '2026-10-28',
    time: '09:00',
    message: 'Hola Luis, ¿podés confirmar tu cita de hoy? Te esperamos.',
  };
  it('el seguimiento no se envía hasta el clic y un segundo clic no lo duplica', () => {
    const state = seedWorkspace('2026-10-28');
    const before = state.patientThread.length;
    const proposal = propose(state, followUp, now);
    expect(state.patientThread).toHaveLength(before);
    expect(state.appointments).toHaveLength(3);
    expect(proposal.change).toMatchObject({
      action: 'follow_up',
      patient: 'Luis Solís (demo)',
      date: '2026-10-28',
      time: '10:30',
      doctorId: 'andres',
      reason: 'unconfirmed',
      message: followUp.message,
    });
    decide(state, proposal.id, true, now);
    decide(state, proposal.id, true, now);
    const sent = state.patientThread.filter((message) => message.proposalId === proposal.id);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.body).toBe(followUp.message);
    expect(sent[0]?.direction).toBe('outbound');
    expect(state.audit).toEqual([
      expect.objectContaining({ action: 'follow_up', appointmentId: 'demo-luis' }),
    ]);
    const visit = state.appointments.find((item) => item.id === 'demo-luis');
    expect(visit).toMatchObject({ time: '10:30', version: 1, attendance: 'unconfirmed' });
  });
  it('rechazar o vencer un seguimiento deja el hilo igual', () => {
    const state = seedWorkspace('2026-10-28');
    const rejected = propose(state, followUp, now);
    const expired = propose(
      state,
      { ...followUp, message: 'Hola Luis, seguimos a la espera de tu confirmación.' },
      now,
    );
    const before = structuredClone(state.patientThread);
    decide(state, rejected.id, false, now);
    decide(state, expired.id, true, new Date(now.getTime() + 600_000));
    expect(rejected.status).toBe('rejected');
    expect(expired.status).toBe('expired');
    expect(state.patientThread).toEqual(before);
    expect(state.audit).toHaveLength(0);
  });
  it('no sigue una cita confirmada, cancelada o con mensaje inválido', () => {
    const state = seedWorkspace('2026-10-28');
    expect(() => propose(state, { ...followUp, appointmentId: 'demo-ana' }, now)).toThrow(
      'confirmed',
    );
    const cancellation = propose(
      state,
      { ...change, action: 'cancel', appointmentId: 'demo-luis' },
      now,
    );
    decide(state, cancellation.id, true, now);
    expect(() => propose(state, followUp, now)).toThrow('disponible');
    const fresh = seedWorkspace('2026-10-28');
    expect(() => propose(fresh, { ...followUp, message: 'Hola' }, now)).toThrow('12');
    expect(fresh.patientThread).toHaveLength(2);
    expect(fresh.audit).toHaveLength(0);
  });
  it('permite seguir una inasistencia de un día anterior sin mover la cita', () => {
    const state = seedWorkspace('2026-10-28');
    const proposal = propose(
      state,
      {
        ...followUp,
        appointmentId: 'demo-sofia',
        message: 'Hola Sofía, lamentamos no verte. ¿Querés elegir otro horario?',
      },
      now,
    );
    expect(proposal.change.reason).toBe('no_show');
    expect(proposal.change.date).not.toBe('2026-10-28');
    decide(state, proposal.id, true, now);
    const visit = state.appointments.find((item) => item.id === 'demo-sofia');
    expect(visit).toMatchObject({ attendance: 'no_show', version: 1, status: 'scheduled' });
    expect(state.patientThread.at(-1)?.body).toContain('Sofía');
  });
  it('un cambio de horario confirmado invalida el seguimiento pendiente', () => {
    const state = seedWorkspace('2026-10-28');
    const pending = propose(state, followUp, now);
    const move = propose(
      state,
      { ...change, action: 'reschedule', appointmentId: 'demo-luis', time: '11:30' },
      now,
    );
    const before = state.patientThread.length;
    decide(state, move.id, true, now);
    expect(() => decide(state, pending.id, true, now)).toThrow('cambió');
    expect(state.patientThread).toHaveLength(before);
    expect(state.appointments.find((item) => item.id === 'demo-luis')?.time).toBe('11:30');
  });
  it('deduplica el mismo seguimiento y otra sesión no puede confirmarlo', () => {
    const state = seedWorkspace('2026-10-28');
    const other = seedWorkspace('2026-10-28');
    expect(propose(state, followUp, now).id).toBe(propose(state, followUp, now).id);
    const proposal = state.proposals[0];
    expect(() => decide(other, proposal.id, true, now)).toThrow('sesión');
    expect(other.patientThread).toHaveLength(state.patientThread.length);
    expect(other.audit).toHaveLength(0);
  });
  it('completa sesiones guardadas antes de existir el seguimiento', () => {
    const seeded = seedWorkspace('2026-10-28');
    const legacy = {
      ...seeded,
      patientThread: undefined,
      appointments: seeded.appointments.map(
        ({ id, patient, doctorId, serviceId, date, time, duration, status, version }) => ({
          id,
          patient,
          doctorId,
          serviceId,
          date,
          time,
          duration,
          status,
          version,
        }),
      ),
    } as unknown as Workspace;
    const hydrated = hydrateWorkspace(legacy);
    expect(hydrated.patientThread).toEqual([]);
    expect(
      hydrated.appointments.every((appointment) => appointment.attendance === 'confirmed'),
    ).toBe(true);
  });
  it('bloquea IDs de profesional y servicio desconocidos', () => {
    expect(() => validateSlot(seedWorkspace(), { ...change, doctorId: 'intruso' }, now)).toThrow();
    expect(() =>
      validateSlot(seedWorkspace(), { ...change, serviceId: 'inventado' }, now),
    ).toThrow();
  });
});
