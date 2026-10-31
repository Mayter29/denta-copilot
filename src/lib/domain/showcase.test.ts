import { describe, expect, it } from 'vitest';
import {
  availableSlots,
  decideBatch,
  patientReply,
  proposeBatchReschedule,
  seedWorkspace,
} from './agenda';
import { getDailyInsights } from './insights';

const now = new Date('2026-10-27T07:00:00-06:00');
const slots = (state: ReturnType<typeof seedWorkspace>) => (date: string, doctorId: string, serviceId: string) =>
  availableSlots(state, date, doctorId, serviceId, now);

describe('briefing operativo', () => {
  it('resume sin confirmar, inasistencias, huecos y pacientes sin futuro', () => {
    const state = seedWorkspace('2026-10-27', { showcase: true });
    const insights = getDailyInsights(state.appointments, '2026-10-27', slots(state));
    expect(insights.tomorrow).toBe('2026-10-28');
    expect(insights.unconfirmedTomorrow.map((p) => p.patient)).toEqual([
      'Paula Jiménez (demo)',
      'Diego Castro (demo)',
    ]);
    expect(insights.recentNoShows.map((p) => p.patient)).toContain('Sofía Rojas (demo)');
    expect(insights.recentNoShows.map((p) => p.patient)).toContain('María Gómez (demo)');
    expect(insights.freeSlots.length).toBeGreaterThan(0);
    expect(insights.patientsWithoutFuture.map((p) => p.patient)).toContain('María Gómez (demo)');
    expect(insights.patientsWithoutFuture.map((p) => p.patient)).toContain('José Pérez (demo)');
    expect(insights.patientsWithoutFuture.map((p) => p.patient)).not.toContain('Paula Jiménez (demo)');
  });

  it('la semilla base sigue intacta para los evals existentes', () => {
    const state = seedWorkspace('2026-10-27');
    expect(state.appointments).toHaveLength(3);
  });
});

describe('reprogramación en lote', () => {
  it('crea una propuesta por cita con espacios distintos y lote compartido', () => {
    const state = seedWorkspace('2026-10-27', { showcase: true });
    const friday = state.appointments.find((a) => a.id === 'demo-show-elena')!.date;
    const batch = proposeBatchReschedule(
      state,
      { doctorId: 'valeria', date: friday, motivo: 'La doctora no viene el viernes.' },
      now,
    );
    expect(batch.affected).toHaveLength(5);
    expect(batch.proposals).toHaveLength(5);
    expect(batch.unresolved).toEqual([]);
    const ids = new Set(batch.proposals.map((p) => p.change.batchId));
    expect(ids.size).toBe(1);
    expect(batch.proposals[0].change.motivo).toBe('La doctora no viene el viernes.');
    const moments = new Set(batch.proposals.map((p) => `${p.change.date}T${p.change.time}`));
    expect(moments.size).toBe(5);
    expect(batch.proposals.every((p) => p.change.date !== friday)).toBe(true);
  });

  it('no mueve citas que ya empezaron ese día', () => {
    const state = seedWorkspace('2026-10-27', { showcase: true });
    const friday = state.appointments.find((a) => a.id === 'demo-show-elena')!.date;
    const midday = new Date(`${friday}T12:00:00-06:00`);
    const batch = proposeBatchReschedule(
      state,
      { doctorId: 'valeria', date: friday, motivo: 'La doctora se retira al mediodía.' },
      midday,
    );
    expect(batch.affected.map((a) => a.time)).toEqual(['13:00', '15:00']);
    const evening = new Date(`${friday}T20:00:00-06:00`);
    expect(() =>
      proposeBatchReschedule(state, { doctorId: 'valeria', date: friday, motivo: 'Ya terminó el día.' }, evening),
    ).toThrow('No hay citas');
  });

  it('rechaza motivo corto, profesional ajeno y día vacío', () => {
    const state = seedWorkspace('2026-10-27', { showcase: true });
    expect(() => proposeBatchReschedule(state, { doctorId: 'valeria', date: '2026-10-30', motivo: 'x' }, now)).toThrow();
    expect(() =>
      proposeBatchReschedule(state, { doctorId: 'intruso', date: '2026-10-30', motivo: 'La doctora no viene.' }, now),
    ).toThrow();
    expect(() =>
      proposeBatchReschedule(state, { doctorId: 'marco', date: '2026-10-30', motivo: 'El doctor no viene.' }, now),
    ).toThrow('No hay citas');
  });

  it('confirma todo junto y el doble clic no duplica', () => {
    const state = seedWorkspace('2026-10-27', { showcase: true });
    const friday = state.appointments.find((a) => a.id === 'demo-show-elena')!.date;
    const batch = proposeBatchReschedule(
      state,
      { doctorId: 'valeria', date: friday, motivo: 'La doctora no viene el viernes.' },
      now,
    );
    const before = state.appointments.length;
    const first = decideBatch(state, batch.batchId, true, now);
    expect(first.confirmed).toHaveLength(5);
    expect(first.failed).toEqual([]);
    expect(state.appointments).toHaveLength(before);
    expect(state.appointments.filter((a) => a.date === friday && a.doctorId === 'valeria')).toHaveLength(0);
    const second = decideBatch(state, batch.batchId, true, now);
    expect(second.confirmed).toEqual([]);
    expect(second.failed).toEqual([]);
  });

  it('reporta parciales cuando una fila choca al confirmar', () => {
    const state = seedWorkspace('2026-10-27', { showcase: true });
    const friday = state.appointments.find((a) => a.id === 'demo-show-elena')!.date;
    const batch = proposeBatchReschedule(
      state,
      { doctorId: 'valeria', date: friday, motivo: 'La doctora no viene el viernes.' },
      now,
    );
    const target = batch.proposals[0];
    state.appointments.push({
      id: 'bloqueo-demo',
      patient: 'Bloqueo Ficticio',
      doctorId: target.change.doctorId,
      serviceId: target.change.serviceId,
      date: target.change.date,
      time: target.change.time,
      duration: 30,
      status: 'scheduled',
      version: 1,
      attendance: 'confirmed',
    });
    const result = decideBatch(state, batch.batchId, true, now);
    expect(result.confirmed).toHaveLength(4);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].id).toBe(target.id);
  });
});

describe('paciente simulado', () => {
  it('confirmar actualiza asistencia y audita; reagendar/cancelar solo dejan mensaje', () => {
    const state = seedWorkspace('2026-10-27');
    const confirmed = patientReply(state, 'demo-luis', 'confirm', now);
    expect(confirmed.direction).toBe('inbound');
    expect(state.appointments.find((a) => a.id === 'demo-luis')?.attendance).toBe('confirmed');
    expect(state.audit.at(-1)).toMatchObject({ action: 'patient_confirm', appointmentId: 'demo-luis' });

    const before = state.appointments.find((a) => a.id === 'demo-ana')?.attendance;
    patientReply(state, 'demo-ana', 'reschedule', now);
    expect(state.appointments.find((a) => a.id === 'demo-ana')?.attendance).toBe(before);
    patientReply(state, 'demo-ana', 'cancel', now);
    expect(state.appointments.find((a) => a.id === 'demo-ana')?.status).toBe('scheduled');
    expect(state.patientThread.filter((m) => m.appointmentId === 'demo-ana')).toHaveLength(2);
  });

  it('rechaza citas inexistentes o canceladas', () => {
    const state = seedWorkspace('2026-10-27');
    expect(() => patientReply(state, 'ausente', 'confirm', now)).toThrow();
  });
});
