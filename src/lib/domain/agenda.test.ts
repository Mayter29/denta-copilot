import { describe, expect, it } from 'vitest';
import {
  availableSlots,
  decide,
  normalizeWorkspace,
  propose,
  seedWorkspace,
  validateSlot,
} from './agenda';
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
    expect(() => decide(s, b.id, true, now)).toThrow('taken');
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
    expect(() => decide(b, p.id, true, now)).toThrow('session');
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
    expect(() => decide(s, b.id, true, now)).toThrow('changed');
  });
  it('permite citas contiguas pero bloquea traslapes parciales', () => {
    const s = seedWorkspace('2026-10-28');
    expect(() => validateSlot(s, { ...change, time: '09:30' }, now)).toThrow('taken');
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
  it('prepares a follow-up without sending and records one message on confirm', () => {
    const s = seedWorkspace('2026-10-28');
    const before = structuredClone(s.appointments);
    const sent = s.patientMessages.length;
    const note = 'Hola Luis, ¿puedes confirmar tu valoración de hoy a las 10:30?';
    const p = propose(
      s,
      {
        action: 'follow_up',
        appointmentId: 'demo-luis',
        patient: 'ignored',
        doctorId: 'valeria',
        serviceId: 'cleaning',
        date: '2026-10-29',
        time: '08:00',
        note,
      },
      now,
    );
    expect(p.change).toMatchObject({
      action: 'follow_up',
      patient: 'Luis Solís (demo)',
      appointmentId: 'demo-luis',
      doctorId: 'andres',
      date: '2026-10-28',
      time: '10:30',
      note,
    });
    expect(s.appointments).toEqual(before);
    expect(s.patientMessages).toHaveLength(sent);
    expect(s.audit).toHaveLength(0);
    decide(s, p.id, true, now);
    decide(s, p.id, true, now);
    expect(s.patientMessages.filter((m) => m.body === note)).toHaveLength(1);
    expect(s.audit).toEqual([
      expect.objectContaining({ action: 'follow_up', appointmentId: 'demo-luis' }),
    ]);
    expect(s.appointments.find((a) => a.id === 'demo-luis')).toMatchObject({
      time: '10:30',
      version: 2,
      outreach: 'unconfirmed',
    });
  });
  it('discards a follow-up without recording a patient message', () => {
    const s = seedWorkspace('2026-10-28');
    const sent = s.patientMessages.length;
    const p = propose(
      s,
      {
        action: 'follow_up',
        appointmentId: 'demo-sofia',
        patient: 'Sofía Rojas (demo)',
        doctorId: 'valeria',
        serviceId: 'evaluation',
        date: '2026-10-28',
        time: '14:00',
        note: 'Hola Sofía, ¿deseas reprogramar la valoración que no pudiste tomar?',
      },
      now,
    );
    decide(s, p.id, false, now);
    expect(p.status).toBe('rejected');
    expect(s.patientMessages).toHaveLength(sent);
    expect(s.audit).toHaveLength(0);
  });
  it('refuses a follow-up when the patient already confirmed', () => {
    const s = seedWorkspace('2026-10-28');
    expect(() =>
      propose(
        s,
        {
          action: 'follow_up',
          appointmentId: 'demo-ana',
          patient: 'Ana Mora (demo)',
          doctorId: 'valeria',
          serviceId: 'cleaning',
          date: '2026-10-28',
          time: '09:00',
          note: 'Hola Ana, este mensaje no debería prepararse.',
        },
        now,
      ),
    ).toThrow('confirmed');
  });
  it('does not record a follow-up if the appointment changed before the click', () => {
    const s = seedWorkspace('2026-10-28');
    const sent = s.patientMessages.length;
    const p = propose(
      s,
      {
        action: 'follow_up',
        appointmentId: 'demo-luis',
        patient: 'Luis Solís (demo)',
        doctorId: 'andres',
        serviceId: 'evaluation',
        date: '2026-10-28',
        time: '10:30',
        note: 'Hola Luis, ¿confirmas la cita de las 10:30?',
      },
      now,
    );
    s.appointments.find((a) => a.id === 'demo-luis')!.version++;
    expect(() => decide(s, p.id, true, now)).toThrow('changed');
    expect(s.patientMessages).toHaveLength(sent);
    expect(p.status).toBe('pending');
  });
  it('fills fields missing from sessions saved before follow-ups', () => {
    const legacy = seedWorkspace('2026-10-28');
    const raw = {
      ...legacy,
      patientMessages: undefined as unknown as typeof legacy.patientMessages,
    };
    raw.appointments[0] = {
      ...raw.appointments[0],
      outreach: undefined as unknown as (typeof raw.appointments)[0]['outreach'],
    };
    const next = normalizeWorkspace(raw);
    expect(next.patientMessages).toEqual([]);
    expect(next.appointments[0].outreach).toBe('unconfirmed');
    expect(next.appointments[1].outreach).toBe('unconfirmed');
  });
  it('bloquea IDs de profesional y servicio desconocidos', () => {
    expect(() => validateSlot(seedWorkspace(), { ...change, doctorId: 'intruso' }, now)).toThrow();
    expect(() =>
      validateSlot(seedWorkspace(), { ...change, serviceId: 'inventado' }, now),
    ).toThrow();
  });
});
