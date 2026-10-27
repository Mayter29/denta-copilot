import { randomUUID } from 'node:crypto';
import {
  clinicToday,
  doctors,
  services,
  type Appointment,
  type Change,
  type PatientMessage,
  type Proposal,
  type Workspace,
} from './types';

export class DomainError extends Error {}
const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
const changed = () => new DomainError('That appointment changed. Ask for a new proposal.');

export function seedWorkspace(date = clinicToday()): Workspace {
  const appointments: Appointment[] = [
    {
      id: 'demo-ana',
      patient: 'Ana Mora (demo)',
      doctorId: 'valeria',
      serviceId: 'cleaning',
      date,
      time: '09:00',
      duration: 60,
      status: 'scheduled',
      outreach: 'confirmed',
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
      outreach: 'unconfirmed',
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
      outreach: 'no_show',
      version: 1,
    },
  ];
  const patientMessages: PatientMessage[] = [
    {
      id: 'demo-msg-ana',
      appointmentId: 'demo-ana',
      patient: 'Ana Mora (demo)',
      direction: 'inbound',
      body: 'Confirmo la limpieza de hoy a las 9:00. Gracias.',
      at: `${date}T13:00:00.000Z`,
    },
    {
      id: 'demo-msg-luis',
      appointmentId: 'demo-luis',
      patient: 'Luis Solís (demo)',
      direction: 'inbound',
      body: 'Hola, vi el recordatorio pero todavía no puedo confirmar. ¿Sigue siendo a las 10:30?',
      at: `${date}T13:05:00.000Z`,
    },
    {
      id: 'demo-msg-sofia',
      appointmentId: 'demo-sofia',
      patient: 'Sofía Rojas (demo)',
      direction: 'outbound',
      body: 'Hola Sofía, te recordamos tu valoración de hoy a las 2:00 p.m. Respóndenos para confirmar.',
      at: `${date}T12:30:00.000Z`,
    },
  ];
  return { appointments, proposals: [], messages: [], patientMessages, audit: [] };
}

export function normalizeWorkspace(state: Workspace): Workspace {
  return {
    appointments: (state.appointments ?? []).map((appointment) => ({
      ...appointment,
      outreach: appointment.outreach ?? 'unconfirmed',
    })),
    proposals: state.proposals ?? [],
    messages: state.messages ?? [],
    audit: state.audit ?? [],
    patientMessages: state.patientMessages ?? [],
  };
}

export function validateSlot(state: Workspace, change: Change, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(change.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(change.time))
    throw new DomainError('Choose a valid date and time.');
  const date = new Date(`${change.date}T12:00:00-06:00`);
  if (Number.isNaN(date.getTime()) || clinicToday(date) !== change.date)
    throw new DomainError('That date does not exist.');
  if (new Date(`${change.date}T${change.time}:00-06:00`).getTime() <= now.getTime())
    throw new DomainError('Choose a future date and time.');
  if (!doctors.some((d) => d.id === change.doctorId))
    throw new DomainError('That clinician is not available.');
  const service = services.find((s) => s.id === change.serviceId);
  if (!service) throw new DomainError('That service is not available.');
  const start = minutes(change.time),
    end = start + service.duration;
  const weekday = date.getUTCDay();
  if (weekday === 0 || start < 480 || end > (weekday === 6 ? 720 : 1020))
    throw new DomainError('That time is outside clinic hours.');
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
    throw new DomainError('That slot is already taken.');
  return service;
}

export function propose(state: Workspace, change: Change, now = new Date()): Proposal {
  if (!change.patient.trim() || change.patient.length > 120)
    throw new DomainError('Enter a valid fictional name.');
  const original = change.appointmentId
    ? state.appointments.find((a) => a.id === change.appointmentId)
    : undefined;
  if (change.action !== 'book' && (!original || original.status !== 'scheduled'))
    throw new DomainError('That appointment is no longer available.');
  if (change.action === 'book' && change.appointmentId)
    throw new DomainError('A new booking cannot replace an existing appointment.');
  const canonical = canonicalChange(change, original);
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
    throw new DomainError('Resolve pending proposals before creating more.');
  const proposal: Proposal = {
    id: randomUUID(),
    change: canonical,
    appointmentVersion: original?.version,
    createdAt: now.getTime(),
    status: 'pending',
  };
  state.proposals.push(proposal);
  return proposal;
}

function canonicalChange(change: Change, original: Appointment | undefined): Change {
  if (change.action === 'follow_up') {
    if (!original || original.outreach === 'confirmed')
      throw new DomainError('That patient already confirmed.');
    const note = change.note?.trim() ?? '';
    if (note.length < 8 || note.length > 400)
      throw new DomainError('Write a short message for the patient.');
    return {
      action: 'follow_up',
      patient: original.patient,
      appointmentId: original.id,
      doctorId: original.doctorId,
      serviceId: original.serviceId,
      date: original.date,
      time: original.time,
      note,
    };
  }
  if (change.action === 'cancel' && original) {
    return {
      action: 'cancel',
      patient: original.patient,
      appointmentId: original.id,
      doctorId: original.doctorId,
      serviceId: original.serviceId,
      date: original.date,
      time: original.time,
    };
  }
  const rest: Change = { ...change, patient: original?.patient ?? change.patient };
  delete rest.note;
  return rest;
}

export function decide(state: Workspace, id: string, approved: boolean, now = new Date()) {
  const proposal = state.proposals.find((p) => p.id === id);
  if (!proposal) throw new DomainError('That proposal is not in this session.');
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
    throw changed();
  if (change.action === 'follow_up') {
    if (!original || original.outreach === 'confirmed' || !change.note) throw changed();
    state.patientMessages.push({
      id: randomUUID(),
      appointmentId: original.id,
      patient: original.patient,
      body: change.note,
      direction: 'outbound',
      at: now.toISOString(),
    });
    original.version++;
    proposal.resultId = original.id;
  } else if (change.action === 'book') {
    const service = validateSlot(state, change, now);
    const appointment: Appointment = {
      id: randomUUID(),
      patient: change.patient,
      doctorId: change.doctorId,
      serviceId: change.serviceId,
      date: change.date,
      time: change.time,
      duration: service.duration,
      status: 'scheduled',
      outreach: 'unconfirmed',
      version: 1,
    };
    state.appointments.push(appointment);
    proposal.resultId = appointment.id;
  } else if (change.action === 'cancel' && original) {
    original.status = 'cancelled';
    original.version++;
    proposal.resultId = original.id;
  } else if (original) {
    const service = validateSlot(state, change, now);
    Object.assign(original, {
      doctorId: change.doctorId,
      serviceId: change.serviceId,
      date: change.date,
      time: change.time,
      duration: service.duration,
    });
    original.version++;
    proposal.resultId = original.id;
  }
  if (!proposal.resultId) throw changed();
  const recorded = state.appointments.find((a) => a.id === proposal.resultId);
  if (!recorded) throw changed();
  proposal.status = 'confirmed';
  state.audit.push({
    id: proposal.id,
    action: change.action,
    appointmentId: proposal.resultId,
    at: now.toISOString(),
  });
  proposal.receipt = {
    kind: 'executed',
    proposalId: proposal.id,
    action: change.action,
    at: now.toISOString(),
    appointment: structuredClone(recorded),
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
