import type { VerifiedResult } from './results';
export type Attendance = 'confirmed' | 'unconfirmed' | 'no_show';
export type Appointment = {
  id: string;
  patient: string;
  doctorId: string;
  serviceId: string;
  date: string;
  time: string;
  duration: number;
  status: 'scheduled' | 'cancelled';
  version: number;
  attendance?: Attendance;
};
export type Change = {
  action: 'book' | 'cancel' | 'reschedule' | 'follow_up';
  patient: string;
  appointmentId?: string;
  doctorId: string;
  serviceId: string;
  date: string;
  time: string;
  message?: string;
  reason?: Exclude<Attendance, 'confirmed'>;
  /** Groups reschedules created by one batch operation. Survives only in local file sessions. */
  batchId?: string;
  /** Human reason for the batch, shown on the grouped card. */
  motivo?: string;
};
export type PatientMessage = {
  id: string;
  appointmentId: string;
  patient: string;
  direction: 'inbound' | 'outbound';
  body: string;
  at: string;
  proposalId?: string;
};
export type Proposal = {
  id: string;
  change: Change;
  appointmentVersion?: number;
  createdAt: number;
  status: 'pending' | 'confirmed' | 'rejected' | 'expired';
  resultId?: string;
  receipt?: {
    kind: 'executed';
    proposalId: string;
    action: string;
    at: string;
    appointment: Appointment;
  };
};
export type ChatEntry = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  result?: VerifiedResult;
  runId?: string;
  promptVersion?: string;
  /** Solo cliente: mensaje optimista aún no confirmado por el servidor. Nunca persiste. */
  pending?: boolean;
};
export type Workspace = {
  appointments: Appointment[];
  proposals: Proposal[];
  messages: ChatEntry[];
  patientThread?: PatientMessage[];
  audit: { id: string; action: string; at: string; appointmentId: string }[];
};
const generalServices = ['evaluation', 'cleaning', 'extraction'];
export const doctors = [
  { id: 'valeria', name: 'Dra. Valeria Soto', specialty: 'Odontología general', services: generalServices },
  { id: 'andres', name: 'Dr. Andrés Vega', specialty: 'Odontología general', services: generalServices },
  { id: 'camila', name: 'Dra. Camila Reyes', specialty: 'Odontología general', services: generalServices },
  { id: 'marco', name: 'Dr. Marco Araya', specialty: 'Ortodoncia', services: ['ortho_control'] },
];
/** True when the professional offers that service. Unknown IDs never match. */
export function offersService(doctorId: string, serviceId: string) {
  return doctors.some((d) => d.id === doctorId && d.services.includes(serviceId));
}
export const services = [
  { id: 'evaluation', name: 'Valoración', duration: 30, price: 15000 },
  { id: 'cleaning', name: 'Limpieza dental', duration: 60, price: 30000 },
  { id: 'extraction', name: 'Extracción simple', duration: 45, price: 45000 },
  { id: 'ortho_control', name: 'Control de ortodoncia', duration: 30, price: 25000 },
];
const clinicDayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Costa_Rica',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
export function clinicToday(now = new Date()) {
  return clinicDayFormat.format(now);
}
const shortWeekdays = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const shortMonths = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** "vie 6 nov" for a clinic date. Deterministic (no ICU) so server and browser render the same text. */
export function formatClinicDate(date: string) {
  const day = new Date(`${date}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(day.getTime())) return date;
  return `${shortWeekdays[day.getUTCDay()]} ${day.getUTCDate()} ${shortMonths[day.getUTCMonth()]}`;
}
