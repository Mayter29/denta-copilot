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
): Workspace & { patientThread: PatientMessage[] } {
  const missed = previousOpenDay(date);
  return {
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
