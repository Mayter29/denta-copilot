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
export const doctors = [
  { id: 'valeria', name: 'Dra. Valeria Soto', specialty: 'Odontología general' },
  { id: 'andres', name: 'Dr. Andrés Vega', specialty: 'Odontología general' },
];
export const services = [
  { id: 'evaluation', name: 'Valoración', duration: 30, price: 15000 },
  { id: 'cleaning', name: 'Limpieza dental', duration: 60, price: 30000 },
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
