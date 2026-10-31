import { formatClinicDate, type Appointment } from './types';

export type InsightSlot = { doctorId: string; date: string; time: string; serviceId: string };
export type InsightPerson = { appointmentId: string; patient: string; date: string; time: string };

export type DailyInsights = {
  today: string;
  tomorrow: string;
  unconfirmedTomorrow: InsightPerson[];
  recentNoShows: InsightPerson[];
  freeSlots: InsightSlot[];
  patientsWithoutFuture: { patient: string; lastVisit: string }[];
};

export type SlotFinder = (
  date: string,
  doctorId: string,
  serviceId: string,
) => string[];

const PREVIEW = 8;

function addDays(date: string, days: number) {
  const cursor = new Date(`${date}T12:00:00Z`);
  cursor.setUTCDate(cursor.getUTCDate() + days);
  return cursor.toISOString().slice(0, 10);
}

function isSunday(date: string) {
  return new Date(`${date}T12:00:00Z`).getUTCDay() === 0;
}

/**
 * Proactive briefing over fictitious session data. Read-only: never proposes
 * or writes. The agent and the UI cards share this exact computation.
 */
export function getDailyInsights(
  appointments: Appointment[],
  today: string,
  findSlots: SlotFinder,
): DailyInsights {
  const scheduled = appointments.filter((a) => a.status === 'scheduled');
  const tomorrow = addDays(today, 1);
  const weekAgo = addDays(today, -7);
  const unconfirmedTomorrow = scheduled
    .filter((a) => a.date === tomorrow && a.attendance === 'unconfirmed')
    .sort((a, b) => a.time.localeCompare(b.time))
    .slice(0, PREVIEW)
    .map((a) => ({ appointmentId: a.id, patient: a.patient, date: a.date, time: a.time }));
  const recentNoShows = scheduled
    .filter((a) => a.attendance === 'no_show' && a.date >= weekAgo && a.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, PREVIEW)
    .map((a) => ({ appointmentId: a.id, patient: a.patient, date: a.date, time: a.time }));
  const doctorIds = [...new Set(scheduled.map((a) => a.doctorId))].sort();
  const serviceByDoctor = new Map<string, string>();
  for (const a of scheduled) {
    if (!serviceByDoctor.has(a.doctorId)) serviceByDoctor.set(a.doctorId, a.serviceId);
  }
  const freeSlots: InsightSlot[] = [];
  for (const doctorId of doctorIds) {
    const serviceId = serviceByDoctor.get(doctorId) ?? 'evaluation';
    for (const day of [tomorrow, addDays(today, 2)]) {
      if (isSunday(day)) continue;
      for (const time of findSlots(day, doctorId, serviceId).slice(0, 3)) {
        freeSlots.push({ doctorId, date: day, time, serviceId });
        if (freeSlots.length >= PREVIEW) break;
      }
      if (freeSlots.length >= PREVIEW) break;
    }
    if (freeSlots.length >= PREVIEW) break;
  }
  const futureByPatient = new Map<string, boolean>();
  for (const a of scheduled) {
    if (a.date >= today) futureByPatient.set(a.patient, true);
    else if (!futureByPatient.has(a.patient)) futureByPatient.set(a.patient, false);
  }
  const lastVisit = new Map<string, string>();
  for (const a of scheduled) {
    if (a.date < today && (!lastVisit.has(a.patient) || lastVisit.get(a.patient)! < a.date))
      lastVisit.set(a.patient, a.date);
  }
  const patientsWithoutFuture = [...futureByPatient.entries()]
    .filter(([, hasFuture]) => !hasFuture)
    .map(([patient]) => ({ patient, lastVisit: lastVisit.get(patient) ?? '' }))
    .sort((a, b) => a.patient.localeCompare(b.patient))
    .slice(0, PREVIEW);
  return { today, tomorrow, unconfirmedTomorrow, recentNoShows, freeSlots, patientsWithoutFuture };
}

export type BriefingAction = { key: string; title: string; detail: string; prompt: string };

/** One-click cards derived from insights. Prompts are user-reviewed chat text, never writes. */
export function briefingActions(
  insights: DailyInsights,
  names: { doctors: Map<string, string>; services: Map<string, string> },
): BriefingAction[] {
  const short = (patient: string) => patient.replace(' (demo)', '');
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const cards: BriefingAction[] = [];
  cards.push({
    key: 'unconfirmed',
    title: 'Sin confirmar para mañana',
    detail:
      insights.unconfirmedTomorrow.length === 0
        ? 'Todo confirmado. Podés revisar los huecos libres.'
        : `${count(insights.unconfirmedTomorrow.length, 'cita', 'citas')}: ${insights.unconfirmedTomorrow
            .slice(0, 3)
            .map((p) => `${short(p.patient)} ${p.time}`)
            .join(' · ')}`,
    prompt: 'Buenos días, Denta. ¿Qué citas están sin confirmar para mañana?',
  });
  cards.push({
    key: 'noshow',
    title: 'Inasistencias recientes',
    detail:
      insights.recentNoShows.length === 0
        ? 'Sin inasistencias esta semana. Buen ritmo.'
        : `${count(insights.recentNoShows.length, 'inasistencia', 'inasistencias')}: ${insights.recentNoShows
            .slice(0, 3)
            .map((p) => short(p.patient))
            .join(' · ')}`,
    prompt: 'Quiero hacer seguimiento de las inasistencias recientes.',
  });
  // One group per professional and day: "Dr. Andrés Vega, sáb 31 oct: 08:00, 08:30".
  const slotGroups = new Map<string, string[]>();
  for (const s of insights.freeSlots.slice(0, 3)) {
    const key = `${names.doctors.get(s.doctorId) ?? s.doctorId}, ${formatClinicDate(s.date)}`;
    slotGroups.set(key, [...(slotGroups.get(key) ?? []), s.time]);
  }
  cards.push({
    key: 'slots',
    title: 'Huecos libres',
    detail:
      slotGroups.size === 0
        ? 'La agenda próxima está completa.'
        : [...slotGroups].map(([key, times]) => `${key}: ${times.join(', ')}`).join(' · '),
    prompt: '¿Qué huecos libres tenemos en los próximos días?',
  });
  cards.push({
    key: 'followup',
    title: 'Pacientes sin cita futura',
    detail:
      insights.patientsWithoutFuture.length === 0
        ? 'Nadie quedó sin próxima cita.'
        : `${count(insights.patientsWithoutFuture.length, 'paciente', 'pacientes')}: ${insights.patientsWithoutFuture
            .slice(0, 3)
            .map((p) => short(p.patient))
            .join(' · ')}`,
    prompt: '¿Qué pacientes se quedaron sin cita futura?',
  });
  return cards;
}
