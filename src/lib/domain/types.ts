import type { VerifiedResult } from './results';
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
};
export type Change = {
  action: 'book' | 'cancel' | 'reschedule';
  patient: string;
  appointmentId?: string;
  doctorId: string;
  serviceId: string;
  date: string;
  time: string;
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
};
export type Workspace = {
  appointments: Appointment[];
  proposals: Proposal[];
  messages: ChatEntry[];
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
export function clinicToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Costa_Rica',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
