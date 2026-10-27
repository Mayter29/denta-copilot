import { randomUUID } from 'node:crypto';
import { clinicToday, doctors, services, type Change, type Proposal, type Workspace } from './types';

export class DomainError extends Error {}
const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
export function seedWorkspace(date = clinicToday()): Workspace {
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
      },
      {
        id: 'demo-sofia',
        patient: 'Sofía Rojas (demo)',
        doctorId: 'valeria',
        serviceId: 'evaluation',
        date,
        time: '14:00',
        duration: 30,
        status: 'scheduled',
        version: 1,
      },
    ],
    proposals: [],
    messages: [],
    audit: [],
  };
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
  const canonical: Change =
    change.action === 'cancel' && original
      ? {
          ...change,
          patient: original.patient,
          doctorId: original.doctorId,
          serviceId: original.serviceId,
          date: original.date,
          time: original.time,
        }
      : { ...change, patient: original?.patient ?? change.patient };
  if (canonical.action !== 'cancel') validateSlot(state, canonical, now);
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
  const service = change.action === 'cancel' ? undefined : validateSlot(state, change, now);
  if (change.action === 'book') {
    const appointment = {
      id: randomUUID(),
      patient: change.patient,
      doctorId: change.doctorId,
      serviceId: change.serviceId,
      date: change.date,
      time: change.time,
      duration: service!.duration,
      status: 'scheduled' as const,
      version: 1,
    };
    state.appointments.push(appointment);
    proposal.resultId = appointment.id;
  } else if (original) {
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
