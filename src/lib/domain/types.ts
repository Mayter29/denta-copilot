import type { VerifiedResult } from './results';
export type Outreach = 'confirmed' | 'unconfirmed' | 'no_show';
export type Appointment = {
  id: string;
  patient: string;
  doctorId: string;
  serviceId: string;
  date: string;
  time: string;
  duration: number;
  status: 'scheduled' | 'cancelled';
  outreach: Outreach;
  version: number;
};
export type Change = {
  action: 'book' | 'cancel' | 'reschedule' | 'follow_up';
  patient: string;
  appointmentId?: string;
  doctorId: string;
  serviceId: string;
  date: string;
  time: string;
  /** Spanish text the patient would read. Only follow-ups store it. */
  note?: string;
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
export type PatientMessage = {
  id: string;
  appointmentId: string;
  patient: string;
  body: string;
  direction: 'inbound' | 'outbound';
  at: string;
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
  patientMessages: PatientMessage[];
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
const clinicDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Costa_Rica',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
export function clinicToday(now = new Date()) {
  return clinicDate.format(now);
}
