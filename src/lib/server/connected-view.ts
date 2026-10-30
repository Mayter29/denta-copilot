import 'server-only';
import { z } from 'zod';
import type {
  Appointment,
  ChatEntry,
  Proposal,
  Workspace,
} from '../domain/types';

const uuid = z.uuid();
const appointmentRow = z.object({
  id: uuid,
  branch_id: uuid,
  professional_id: uuid,
  service_id: uuid,
  patient_label: z.string(),
  starts_at: z.string(),
  duration_minutes: z.number().int(),
  status: z.enum(['scheduled', 'cancelled']),
  version: z.number().int(),
});
const professionalRow = z.object({ id: uuid, name: z.string(), active: z.boolean() });
const serviceRow = z.object({
  id: uuid,
  name: z.string(),
  duration_minutes: z.number().int(),
  price_minor: z.number().int(),
  active: z.boolean(),
});
const hoursRow = z.object({ weekday: z.number().int(), opens_at: z.string(), closes_at: z.string() });
const proposalRow = z.object({
  id: uuid,
  branch_id: uuid,
  conversation_id: uuid,
  run_id: uuid,
  operation: z.enum(['book', 'cancel', 'reschedule']),
  command: z.object({
    patient_label: z.string().optional(),
    professional_id: uuid.optional(),
    service_id: uuid.optional(),
    starts_at: z.string().optional(),
    appointment_id: uuid.optional(),
    expected_version: z.number().int().optional(),
  }),
  status: z.enum(['pending', 'confirmed', 'rejected', 'expired']),
  created_at: z.string(),
});
const receiptRow = z.object({
  proposal_id: uuid,
  effect_reference: z.string(),
  resource_snapshot: z.unknown(),
  completed_at: z.string(),
});
const decisionRow = z.object({
  proposal_id: uuid,
  approved: z.boolean(),
  decided_at: z.string(),
});
const messageRow = z.object({
  id: uuid,
  conversation_id: uuid,
  run_id: uuid,
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  result_kind: z.enum(['answer', 'needs_input', 'proposal', 'failed', 'paused']).nullable(),
});
const sourceRow = z.object({ id: uuid, title: z.string(), content: z.string(), content_hash: z.string() });
const messageSourceRow = z.object({ message_id: uuid, source_id: uuid });

export type ReaderClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string,
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
  };
};

/** Branch-local calendar day and time for a UTC instant. */
export function toBranchLocal(iso: string, timeZone: string) {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) throw new Error('Fecha remota inválida.');
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}

/** Wall-clock date+time in a branch zone to a UTC instant. Handles zones with DST via Intl offset lookup. */
export function zonedTimeToUtc(date: string, time: string, timeZone: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    throw new Error('Fecha u hora inválida.');
  const guess = new Date(`${date}T${time}:00Z`);
  const offsetMinutes = tzOffsetMinutes(guess, timeZone);
  const utc = new Date(guess.getTime() - offsetMinutes * 60_000);
  // Re-resolve once: DST transitions near midnight can shift the wall reading.
  const check = tzOffsetMinutes(utc, timeZone);
  const resolved = check === offsetMinutes ? utc : new Date(guess.getTime() - check * 60_000);
  return resolved.toISOString();
}

function tzOffsetMinutes(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

export function mapAppointment(row: unknown, timeZone: string): Appointment {
  const parsed = appointmentRow.parse(row);
  const local = toBranchLocal(parsed.starts_at, timeZone);
  return {
    id: parsed.id,
    patient: parsed.patient_label,
    doctorId: parsed.professional_id,
    serviceId: parsed.service_id,
    date: local.date,
    time: local.time,
    duration: parsed.duration_minutes,
    status: parsed.status,
    version: parsed.version,
  };
}

export function mapProposal(row: unknown, receipt: unknown, timeZone: string): Proposal {
  const parsed = proposalRow.parse(row);
  const command = parsed.command;
  const start = command.starts_at ? toBranchLocal(command.starts_at, timeZone) : null;
  const proposal: Proposal = {
    id: parsed.id,
    change: {
      action: parsed.operation,
      patient: command.patient_label ?? '',
      appointmentId: command.appointment_id,
      doctorId: command.professional_id ?? '',
      serviceId: command.service_id ?? '',
      date: start?.date ?? '',
      time: start?.time ?? '',
    },
    createdAt: new Date(parsed.created_at).getTime(),
    status: parsed.status,
  };
  if (receipt) {
    const parsedReceipt = receiptRow.parse(receipt);
    proposal.resultId = parsedReceipt.effect_reference;
    proposal.receipt = {
      kind: 'executed',
      proposalId: parsed.id,
      action: parsed.operation,
      at: parsedReceipt.completed_at,
      appointment: mapAppointment(parsedReceipt.resource_snapshot, timeZone),
    };
  }
  return proposal;
}

type QueryResult = { data: unknown; error: { message: string } | null };

/** Reads the authorized context with the user's JWT (RLS applies) and maps it to the local view shape. */
export async function readConnectedContext(
  client: ReaderClient,
  input: { tenantId: string; branchId: string; conversationId: string; timeZone: string },
) {
  const scoped = (table: string, columns: string) =>
    client.from(table).select(columns).eq('tenant_id', input.tenantId);
  const [appointments, professionals, services, hours, proposals, receipts, decisions, messages, sources, messageSources] =
    await Promise.all<QueryResult>([
      scoped('dc_demo_appointments', 'id,branch_id,professional_id,service_id,patient_label,starts_at,duration_minutes,status,version'),
      scoped('dc_demo_professionals', 'id,name,active'),
      scoped('dc_demo_services', 'id,name,duration_minutes,price_minor,active'),
      scoped('dc_demo_business_hours', 'weekday,opens_at,closes_at'),
      scoped('dc_proposals', 'id,branch_id,conversation_id,run_id,operation,command,status,created_at'),
      scoped('dc_receipts', 'proposal_id,effect_reference,resource_snapshot,completed_at'),
      scoped('dc_decisions', 'proposal_id,approved,decided_at'),
      scoped('dc_messages', 'id,conversation_id,run_id,role,content,result_kind'),
      scoped('dc_sources', 'id,title,content,content_hash'),
      scoped('dc_message_sources', 'message_id,source_id'),
    ]);
  const results = [appointments, professionals, services, hours, proposals, receipts, decisions, messages, sources, messageSources];
  for (const result of results) {
    if (result.error) throw new Error('No se pudo leer la agenda conectada.');
  }
  const branchFilter = <T extends { branch_id: string }>(rows: T[]) =>
    rows.filter((row) => row.branch_id === input.branchId);
  return buildConnectedView(
    {
      appointments: branchFilter(z.array(appointmentRow).parse(appointments.data ?? [])),
      professionals: z.array(professionalRow).parse(professionals.data ?? []),
      services: z.array(serviceRow).parse(services.data ?? []),
      hours: z.array(hoursRow).parse(hours.data ?? []),
      proposals: z
        .array(proposalRow)
        .parse(proposals.data ?? [])
        .filter((p) => p.branch_id === input.branchId && p.conversation_id === input.conversationId),
      receipts: z.array(receiptRow).parse(receipts.data ?? []),
      decisions: z.array(decisionRow).parse(decisions.data ?? []),
      messages: z
        .array(messageRow)
        .parse(messages.data ?? [])
        .filter((m) => m.conversation_id === input.conversationId),
      sources: z.array(sourceRow).parse(sources.data ?? []),
      messageSources: z.array(messageSourceRow).parse(messageSources.data ?? []),
    },
    input.timeZone,
  );
}

export type ConnectedReads = {
  appointments: z.infer<typeof appointmentRow>[];
  professionals: z.infer<typeof professionalRow>[];
  services: z.infer<typeof serviceRow>[];
  hours: z.infer<typeof hoursRow>[];
  proposals: z.infer<typeof proposalRow>[];
  receipts: z.infer<typeof receiptRow>[];
  decisions: z.infer<typeof decisionRow>[];
  messages: z.infer<typeof messageRow>[];
  sources: z.infer<typeof sourceRow>[];
  messageSources: z.infer<typeof messageSourceRow>[];
};

export function buildConnectedView(reads: ConnectedReads, timeZone: string) {
  const receiptByProposal = new Map(reads.receipts.map((r) => [r.proposal_id, r]));
  const sourceById = new Map(reads.sources.map((s) => [s.id, s]));
  const sourcesByMessage = new Map<string, { id: string; title: string; content: string; version: string }[]>();
  for (const link of reads.messageSources) {
    const source = sourceById.get(link.source_id);
    if (!source) continue;
    const list = sourcesByMessage.get(link.message_id) ?? [];
    list.push({ id: source.id, title: source.title, content: source.content, version: source.content_hash });
    sourcesByMessage.set(link.message_id, list);
  }
  const runByProposal = new Map(reads.proposals.map((p) => [p.id, p.run_id]));
  const proposalsByRun = new Map<string, Proposal[]>();
  const proposals = reads.proposals.map((p) => mapProposal(p, receiptByProposal.get(p.id) ?? null, timeZone));
  for (const proposal of proposals) {
    const runId = runByProposal.get(proposal.id);
    if (!runId) continue;
    const list = proposalsByRun.get(runId) ?? [];
    list.push(proposal);
    proposalsByRun.set(runId, list);
  }
  const messages: ChatEntry[] = reads.messages.map((m) => {
    if (m.role === 'user') return { id: m.id, role: m.role, content: m.content };
    return {
      id: m.id,
      role: m.role,
      content: m.content,
      result: {
        kind: m.result_kind ?? 'answer',
        text: m.content,
        execution: 'none' as const,
        sources: sourcesByMessage.get(m.id) ?? [],
        proposals: proposalsByRun.get(m.run_id) ?? [],
      },
    };
  });
  const operationByProposal = new Map(reads.proposals.map((p) => [p.id, p.operation]));
  const audit: Workspace['audit'] = reads.decisions
    .filter((d) => d.approved)
    .map((d) => ({
      id: d.proposal_id,
      action: (operationByProposal.get(d.proposal_id) ?? 'book') as 'book' | 'cancel' | 'reschedule',
      at: d.decided_at,
      appointmentId: receiptByProposal.get(d.proposal_id)?.effect_reference ?? '',
    }));
  return {
    appointments: reads.appointments.map((a) => mapAppointment(a, timeZone)),
    proposals,
    messages,
    audit,
    doctors: reads.professionals
      .filter((p) => p.active)
      .map((p) => ({ id: p.id, name: p.name, specialty: 'Odontología general' })),
    services: reads.services
      .filter((s) => s.active)
      .map((s) => ({ id: s.id, name: s.name, duration: s.duration_minutes, price: s.price_minor })),
    knowledge: reads.sources.map((s) => ({ id: s.id, title: s.title, content: s.content })),
    hoursNote: formatHours(reads.hours),
  };
}

const weekdays = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
function formatHours(hours: { weekday: number; opens_at: string; closes_at: string }[]) {
  if (!hours.length) return 'Horario de la sede no publicado.';
  const short = (t: string) => t.slice(0, 5);
  return hours
    .slice()
    .sort((a, b) => a.weekday - b.weekday || (a.opens_at < b.opens_at ? -1 : 1))
    .map((h) => `${weekdays[h.weekday] ?? ''} ${short(h.opens_at)}–${short(h.closes_at)}`)
    .join(' · ');
}
