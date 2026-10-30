import { randomUUID } from 'node:crypto';
import {
  clinicToday,
  doctors,
  services,
  type Appointment,
  type Attendance,
  type Change,
  type Proposal,
  type PatientMessage,
  type Workspace,
} from './types';

export class DomainError extends Error {}
const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
const attendances = new Set<Attendance>(['confirmed', 'unconfirmed', 'no_show']);

export function previousOpenDay(date: string) {
  const cursor = new Date(`${date}T12:00:00-06:00`);
  do {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  } while (cursor.getUTCDay() === 0);
  return clinicToday(cursor);
}

export function seedWorkspace(
  date = clinicToday(),
  options: { showcase?: boolean } = {},
): Workspace & { patientThread: PatientMessage[] } {
  const missed = previousOpenDay(date);
  const base: Workspace & { patientThread: PatientMessage[] } = {
    appointments: [
      {
        id: 'demo-ana',
        patient: 'Ana Mora (demo)',
        doctorId: 'valeria',
        serviceId: 'cleaning',
        date,
        time: '09:00',
        duration: 60,
        status: 'scheduled',
        version: 1,
        attendance: 'confirmed',
      },
      {
        id: 'demo-luis',
        patient: 'Luis Solís (demo)',
        doctorId: 'andres',
        serviceId: 'evaluation',
        date,
        time: '10:30',
        duration: 30,
        status: 'scheduled',
        version: 1,
        attendance: 'unconfirmed',
      },
      {
        id: 'demo-sofia',
        patient: 'Sofía Rojas (demo)',
        doctorId: 'valeria',
        serviceId: 'evaluation',
        date: missed,
        time: '11:00',
        duration: 30,
        status: 'scheduled',
        version: 1,
        attendance: 'no_show',
      },
    ],
    proposals: [],
    messages: [],
    audit: [],
    patientThread: [
      {
        id: 'demo-msg-luis',
        appointmentId: 'demo-luis',
        patient: 'Luis Solís (demo)',
        direction: 'inbound',
        body: 'Hola, vi el recordatorio pero todavía no puedo confirmar la hora de hoy.',
        at: `${date}T08:05:00-06:00`,
      },
      {
        id: 'demo-msg-sofia',
        appointmentId: 'demo-sofia',
        patient: 'Sofía Rojas (demo)',
        direction: 'inbound',
        body: 'Disculpe, no pude llegar a la cita. ¿Me pueden ayudar a reprogramar?',
        at: `${missed}T12:10:00-06:00`,
      },
    ],
  };
  if (options.showcase) {
    base.appointments.push(...showcaseAppointments(date));
    base.patientThread.push(...showcaseThread(date));
  }
  return base;
}

function addDays(date: string, days: number) {
  const cursor = new Date(`${date}T12:00:00-06:00`);
  cursor.setUTCDate(cursor.getUTCDate() + days);
  return clinicToday(cursor);
}

function nextWeekday(date: string, weekday: number) {
  let cursor = addDays(date, 1);
  while (new Date(`${cursor}T12:00:00-06:00`).getUTCDay() !== weekday) cursor = addDays(cursor, 1);
  return cursor;
}

/** Two weeks of fictitious appointments with demo patterns. Never real data. */
function showcaseAppointments(
  date: string,
): (Workspace['appointments'][number] & { attendance: Attendance })[] {
  const sunday = (day: string) => new Date(`${day}T12:00:00-06:00`).getUTCDay() === 0;
  const morning = sunday(addDays(date, 1)) ? addDays(date, 2) : addDays(date, 1);
  const friday = nextWeekday(date, 5);
  const monday = nextWeekday(date, 1);
  const dayAfter = sunday(addDays(date, 2)) ? addDays(date, 3) : addDays(date, 2);
  const list: (Workspace['appointments'][number] & { attendance: Attendance })[] = [
    { id: 'demo-show-paula', patient: 'Paula Jiménez (demo)', doctorId: 'valeria', serviceId: 'evaluation', date: morning, time: '08:30', duration: 30, status: 'scheduled', version: 1, attendance: 'unconfirmed' },
    { id: 'demo-show-diego', patient: 'Diego Castro (demo)', doctorId: 'andres', serviceId: 'cleaning', date: morning, time: '09:00', duration: 60, status: 'scheduled', version: 1, attendance: 'unconfirmed' },
    { id: 'demo-show-lucia', patient: 'Lucía Fernández (demo)', doctorId: 'camila', serviceId: 'evaluation', date: morning, time: '10:00', duration: 30, status: 'scheduled', version: 1, attendance: 'confirmed' },
    { id: 'demo-show-elena', patient: 'Elena Vargas (demo)', doctorId: 'valeria', serviceId: 'evaluation', date: friday, time: '08:00', duration: 30, status: 'scheduled', version: 1, attendance: 'confirmed' },
    { id: 'demo-show-mario', patient: 'Mario Quirós (demo)', doctorId: 'valeria', serviceId: 'cleaning', date: friday, time: '09:00', duration: 60, status: 'scheduled', version: 1, attendance: 'confirmed' },
    { id: 'demo-show-mendez', patient: 'Sofía Méndez (demo)', doctorId: 'valeria', serviceId: 'evaluation', date: friday, time: '10:30', duration: 30, status: 'scheduled', version: 1, attendance: 'unconfirmed' },
    { id: 'demo-show-rosa', patient: 'Rosa Aguilar (demo)', doctorId: 'valeria', serviceId: 'extraction', date: friday, time: '13:00', duration: 45, status: 'scheduled', version: 1, attendance: 'confirmed' },
    { id: 'demo-show-pablo', patient: 'Pablo Núñez (demo)', doctorId: 'valeria', serviceId: 'ortho_control', date: friday, time: '15:00', duration: 30, status: 'scheduled', version: 1, attendance: 'unconfirmed' },
    { id: 'demo-show-maria', patient: 'María Gómez (demo)', doctorId: 'valeria', serviceId: 'evaluation', date: addDays(date, -6), time: '10:00', duration: 30, status: 'scheduled', version: 1, attendance: 'no_show' },
    { id: 'demo-show-jose', patient: 'José Pérez (demo)', doctorId: 'andres', serviceId: 'evaluation', date: addDays(date, -3), time: '11:00', duration: 30, status: 'scheduled', version: 1, attendance: 'no_show' },
    { id: 'demo-show-carmen', patient: 'Carmen Ruiz (demo)', doctorId: 'marco', serviceId: 'ortho_control', date: monday, time: '09:00', duration: 30, status: 'scheduled', version: 1, attendance: 'confirmed' },
    { id: 'demo-show-jorge', patient: 'Jorge Miranda (demo)', doctorId: 'andres', serviceId: 'cleaning', date: dayAfter, time: '14:00', duration: 60, status: 'scheduled', version: 1, attendance: 'confirmed' },
  ];
  return list;
}

function showcaseThread(date: string): PatientMessage[] {
  return [
    {
      id: 'demo-show-msg-maria',
      appointmentId: 'demo-show-maria',
      patient: 'María Gómez (demo)',
      direction: 'inbound',
      body: 'Hola, no pude llegar a mi cita. ¿Me ayudan a buscar otro espacio?',
      at: `${addDays(date, -6)}T12:10:00-06:00`,
    },
  ];
}

export function hydrateWorkspace(state: Workspace): Workspace {
  state.appointments = state.appointments.map((appointment) => ({
    ...appointment,
    attendance:
      appointment.attendance && attendances.has(appointment.attendance)
        ? appointment.attendance
        : 'confirmed',
  }));
  state.patientThread ??= [];
  return state;
}

function followUpMessage(message: string | undefined) {
  const text = message?.trim() ?? '';
  if (text.length < 12 || text.length > 320)
    throw new DomainError('Follow-up message must be 12–320 characters.');
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text))
    throw new DomainError('Follow-up message has invalid characters.');
  return text;
}

function needsFollowUp(appointment: Appointment | undefined): appointment is Appointment {
  return (
    !!appointment &&
    appointment.status === 'scheduled' &&
    (appointment.attendance === 'unconfirmed' || appointment.attendance === 'no_show')
  );
}
export function validateSlot(state: Workspace, change: Change, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(change.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(change.time))
    throw new DomainError('Fecha u hora inválida.');
  const date = new Date(`${change.date}T12:00:00-06:00`);
  if (Number.isNaN(date.getTime()) || clinicToday(date) !== change.date)
    throw new DomainError('La fecha no existe.');
  if (new Date(`${change.date}T${change.time}:00-06:00`).getTime() <= now.getTime())
    throw new DomainError('Elegí una fecha y hora futuras.');
  if (!doctors.some((d) => d.id === change.doctorId))
    throw new DomainError('Profesional no disponible.');
  const service = services.find((s) => s.id === change.serviceId);
  if (!service) throw new DomainError('Servicio no disponible.');
  const start = minutes(change.time),
    end = start + service.duration;
  const weekday = date.getUTCDay();
  if (weekday === 0 || start < 480 || end > (weekday === 6 ? 720 : 1020))
    throw new DomainError('La cita queda fuera del horario de la clínica.');
  if (
    state.appointments.some(
      (a) =>
        a.id !== change.appointmentId &&
        a.status === 'scheduled' &&
        a.doctorId === change.doctorId &&
        a.date === change.date &&
        start < minutes(a.time) + a.duration &&
        end > minutes(a.time),
    )
  )
    throw new DomainError('Ese espacio ya está ocupado. Busquemos otra hora.');
  return service;
}
export function propose(state: Workspace, change: Change, now = new Date()): Proposal {
  if (!change.patient.trim() || change.patient.length > 120)
    throw new DomainError('Ingresá un nombre ficticio válido.');
  const original = change.appointmentId
    ? state.appointments.find((a) => a.id === change.appointmentId)
    : undefined;
  if (change.action !== 'book' && (!original || original.status !== 'scheduled'))
    throw new DomainError('La cita ya no está disponible.');
  if (change.action === 'book' && change.appointmentId)
    throw new DomainError('Una reserva nueva no puede reemplazar una cita.');
  if (change.action === 'follow_up' && !needsFollowUp(original))
    throw new DomainError('That visit is already confirmed.');
  const canonical: Change =
    change.action === 'follow_up' && original
      ? {
          action: 'follow_up',
          patient: original.patient,
          appointmentId: original.id,
          doctorId: original.doctorId,
          serviceId: original.serviceId,
          date: original.date,
          time: original.time,
          message: followUpMessage(change.message),
          reason: original.attendance === 'no_show' ? 'no_show' : 'unconfirmed',
        }
      : change.action === 'cancel' && original
        ? {
            action: 'cancel',
            patient: original.patient,
            appointmentId: original.id,
            doctorId: original.doctorId,
            serviceId: original.serviceId,
            date: original.date,
            time: original.time,
          }
        : { ...change, patient: original?.patient ?? change.patient };
  if (canonical.action !== 'cancel' && canonical.action !== 'follow_up')
    validateSlot(state, canonical, now);
  const duplicate = state.proposals.find(
    (p) =>
      p.status === 'pending' &&
      now.getTime() - p.createdAt < 600_000 &&
      JSON.stringify(p.change) === JSON.stringify(canonical),
  );
  if (duplicate) return duplicate;
  if (state.proposals.filter((p) => p.status === 'pending').length >= 20)
    throw new DomainError('Resolvé las propuestas pendientes antes de crear más.');
  const proposal = {
    id: randomUUID(),
    change: canonical,
    appointmentVersion: original?.version,
    createdAt: now.getTime(),
    status: 'pending' as const,
  };
  state.proposals.push(proposal);
  return proposal;
}
export function decide(state: Workspace, id: string, approved: boolean, now = new Date()) {
  const proposal = state.proposals.find((p) => p.id === id);
  if (!proposal) throw new DomainError('No encontramos esa propuesta en esta sesión.');
  if (proposal.status !== 'pending') return proposal;
  if (now.getTime() - proposal.createdAt >= 600_000) {
    proposal.status = 'expired';
    return proposal;
  }
  if (!approved) {
    proposal.status = 'rejected';
    return proposal;
  }
  const change = proposal.change;
  const original = state.appointments.find((a) => a.id === change.appointmentId);
  if (
    change.action !== 'book' &&
    (!original ||
      original.version !== proposal.appointmentVersion ||
      original.status !== 'scheduled')
  )
    throw new DomainError('La cita cambió. Pedí una propuesta nueva.');
  if (change.action === 'follow_up') {
    if (!needsFollowUp(original) || !change.message)
      throw new DomainError('La cita cambió. Pedí una propuesta nueva.');
    state.patientThread ??= [];
    state.patientThread.push({
      id: randomUUID(),
      appointmentId: original.id,
      patient: original.patient,
      direction: 'outbound',
      body: change.message,
      at: now.toISOString(),
      proposalId: proposal.id,
    });
    proposal.resultId = original.id;
  } else if (change.action === 'book') {
    const service = validateSlot(state, change, now);
    const appointment = {
      id: randomUUID(),
      patient: change.patient,
      doctorId: change.doctorId,
      serviceId: change.serviceId,
      date: change.date,
      time: change.time,
      duration: service.duration,
      status: 'scheduled' as const,
      version: 1,
      attendance: 'confirmed' as const,
    };
    state.appointments.push(appointment);
    proposal.resultId = appointment.id;
  } else if (original) {
    const service = change.action === 'cancel' ? undefined : validateSlot(state, change, now);
    if (change.action === 'cancel') original.status = 'cancelled';
    else
      Object.assign(original, {
        doctorId: change.doctorId,
        serviceId: change.serviceId,
        date: change.date,
        time: change.time,
        duration: service!.duration,
      });
    original.version++;
    proposal.resultId = original.id;
  }
  proposal.status = 'confirmed';
  state.audit.push({
    id: proposal.id,
    action: change.action,
    appointmentId: proposal.resultId!,
    at: now.toISOString(),
  });
  proposal.receipt = {
    kind: 'executed',
    proposalId: proposal.id,
    action: change.action,
    at: now.toISOString(),
    appointment: structuredClone(state.appointments.find((a) => a.id === proposal.resultId)!),
  };
  return proposal;
}
export function availableSlots(
  state: Workspace,
  date: string,
  doctorId: string,
  serviceId: string,
  now = new Date(),
) {
  return Array.from(
    { length: 18 },
    (_, n) => `${String(8 + Math.floor(n / 2)).padStart(2, '0')}:${n % 2 ? '30' : '00'}`,
  ).filter((time) => {
    try {
      validateSlot(
        state,
        { action: 'book', patient: 'demo', date, time, doctorId, serviceId },
        now,
      );
      return true;
    } catch {
      return false;
    }
  });
}

export type BatchInput = { doctorId: string; date: string; motivo: string };
export type BatchResult = {
  batchId: string;
  motivo: string;
  date: string;
  doctorId: string;
  affected: { appointmentId: string; patient: string; time: string; serviceId: string }[];
  proposals: Proposal[];
  unresolved: { appointmentId: string; patient: string; reason: string }[];
};

/**
 * Builds one reschedule proposal per affected visit, each with its own free slot.
 * Proposals only; every row still needs a human click, individually or as a batch.
 */
export function proposeBatchReschedule(
  state: Workspace,
  input: BatchInput,
  now = new Date(),
): BatchResult {
  const motivo = input.motivo.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new DomainError('Fecha inválida.');
  if (motivo.length < 4 || motivo.length > 140)
    throw new DomainError('Contanos el motivo en 4 a 140 caracteres.');
  if (!doctors.some((d) => d.id === input.doctorId))
    throw new DomainError('Profesional no disponible.');
  const affected = state.appointments
    .filter((a) => a.status === 'scheduled' && a.doctorId === input.doctorId && a.date === input.date)
    .sort((a, b) => a.time.localeCompare(b.time));
  if (!affected.length)
    throw new DomainError('No hay citas programadas ese día para ese profesional.');
  const batchId = randomUUID();
  const taken: { date: string; start: number; end: number }[] = [];
  const created: Proposal[] = [];
  const unresolved: BatchResult['unresolved'] = [];
  const serviceOf = (serviceId: string) => services.find((s) => s.id === serviceId);
  for (const appointment of affected) {
    let placed: Proposal | undefined;
    let reason = 'Sin espacio en los próximos 14 días.';
    const duration = serviceOf(appointment.serviceId)?.duration ?? appointment.duration;
    for (let offset = 1; offset <= 14 && !placed; offset++) {
      const day = addDays(input.date, offset);
      if (new Date(`${day}T12:00:00-06:00`).getUTCDay() === 0) continue;
      const free = availableSlots(state, day, appointment.doctorId, appointment.serviceId, now).filter(
        (time) => {
          const start = minutes(time);
          const end = start + duration;
          return !taken.some((slot) => slot.date === day && start < slot.end && end > slot.start);
        },
      );
      if (!free.length) continue;
      try {
        placed = propose(
          state,
          {
            action: 'reschedule',
            patient: appointment.patient,
            appointmentId: appointment.id,
            doctorId: appointment.doctorId,
            serviceId: appointment.serviceId,
            date: day,
            time: free[0],
            batchId,
            motivo,
          },
          now,
        );
        taken.push({ date: day, start: minutes(free[0]), end: minutes(free[0]) + duration });
      } catch (error) {
        reason = error instanceof DomainError ? error.message : 'No se pudo preparar la propuesta.';
      }
    }
    if (placed) created.push(placed);
    else unresolved.push({ appointmentId: appointment.id, patient: appointment.patient, reason });
  }
  if (!created.length) throw new DomainError(unresolved[0]?.reason ?? 'No se pudo preparar la propuesta.');
  return {
    batchId,
    motivo,
    date: input.date,
    doctorId: input.doctorId,
    affected: affected.map((a) => ({
      appointmentId: a.id,
      patient: a.patient,
      time: a.time,
      serviceId: a.serviceId,
    })),
    proposals: created,
    unresolved,
  };
}

export type BatchDecision = {
  batchId: string;
  confirmed: string[];
  failed: { id: string; error: string }[];
};

/** Decides every pending proposal of a batch, row by row. Partial results are reported. */
export function decideBatch(
  state: Workspace,
  batchId: string,
  approved: boolean,
  now = new Date(),
): BatchDecision {
  const grouped = state.proposals.filter((p) => p.change.batchId === batchId);
  if (!grouped.length) throw new DomainError('No encontramos propuestas de ese grupo.');
  const pending = grouped.filter((p) => p.status === 'pending');
  const result: BatchDecision = { batchId, confirmed: [], failed: [] };
  if (!pending.length) return result;
  if (!approved) {
    for (const proposal of pending) proposal.status = 'rejected';
    return result;
  }
  for (const proposal of pending) {
    try {
      decide(state, proposal.id, approved, now);
      if (proposal.status === 'confirmed') result.confirmed.push(proposal.id);
      else result.failed.push({ id: proposal.id, error: 'La propuesta no quedó confirmada.' });
    } catch (error) {
      result.failed.push({
        id: proposal.id,
        error: error instanceof DomainError ? error.message : 'No se pudo confirmar.',
      });
    }
  }
  return result;
}

export type PatientReply = 'confirm' | 'reschedule' | 'cancel';

/**
 * Simulated patient answer in the demo channel. Confirming records attendance;
 * asking to reschedule or cancel only leaves a message — the agenda still
 * changes exclusively through a human-confirmed proposal card.
 */
export function patientReply(
  state: Workspace,
  appointmentId: string,
  reply: PatientReply,
  now = new Date(),
): PatientMessage {
  const appointment = state.appointments.find((a) => a.id === appointmentId);
  if (!appointment || appointment.status !== 'scheduled')
    throw new DomainError('La cita ya no está disponible.');
  const bodies: Record<PatientReply, string> = {
    confirm: `Hola, confirmo mi cita del ${appointment.date} a las ${appointment.time}. ¡Gracias!`,
    reschedule: `Hola, no puedo llegar a mi cita del ${appointment.date} a las ${appointment.time}. ¿Me ayudan a reprogramarla, por favor?`,
    cancel: `Hola, necesito cancelar mi cita del ${appointment.date} a las ${appointment.time}. ¡Gracias!`,
  };
  const message: PatientMessage = {
    id: randomUUID(),
    appointmentId: appointment.id,
    patient: appointment.patient,
    direction: 'inbound',
    body: bodies[reply],
    at: now.toISOString(),
  };
  state.patientThread ??= [];
  state.patientThread.push(message);
  if (reply === 'confirm') {
    appointment.attendance = 'confirmed';
    appointment.version++;
    state.audit.push({
      id: message.id,
      action: 'patient_confirm',
      appointmentId: appointment.id,
      at: message.at,
    });
  }
  return message;
}

/** Server-owned summary of a simulated reply, in voseo. Display only; never a write receipt. */
export function patientReplySummary(reply: PatientReply, patient: string): string {
  const name = patient.replace(' (demo)', '');
  if (reply === 'confirm') return `${name} confirmó su cita por el canal simulado. La agenda ya muestra la asistencia confirmada.`;
  if (reply === 'reschedule')
    return `${name} pidió reprogramar por el canal simulado. La agenda sigue igual: prepará la propuesta de reagendamiento y confirmala con un clic.`;
  return `${name} pidió cancelar por el canal simulado. La agenda sigue igual: prepará la propuesta de cancelación y confirmala con un clic.`;
}
