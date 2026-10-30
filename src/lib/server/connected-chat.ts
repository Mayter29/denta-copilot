import 'server-only';
import { z } from 'zod';
import type { LanguageModel } from 'ai';
import { providerModel } from './agent';
import { clinicToday } from '../domain/types';
import type { ChatProgress } from '../domain/chat-progress';
import { createCopilotStore, type CopilotStore } from './copilot-store';
import { mapAppointment, readConnectedContext, type ReaderClient } from './connected-view';
import {
  CONNECTED_PROMPT_VERSION,
  runSecretaryConnected,
  type ConnectedReads,
} from './supabase-agent';
import { RequestError } from './workspace';
import { userSupabase } from './auth';

const selectionSchema = z.object({ tenantId: z.uuid(), branchId: z.uuid() });

/** Fail-fast membership check with the user's JWT. RPCs re-enforce scheduler roles. */
export async function requireBranchAccess(
  client: ReaderClient,
  input: { tenantId: string; branchId: string },
) {
  const parsed = selectionSchema.parse(input);
  const { data, error } = await client
    .from('dc_branch_memberships')
    .select('tenant_id,branch_id')
    .eq('tenant_id', parsed.tenantId);
  if (error) throw new Error('No se pudo verificar el acceso a la sede.');
  const rows = z.array(z.object({ tenant_id: z.uuid(), branch_id: z.uuid() })).parse(data ?? []);
  if (!rows.some((r) => r.branch_id === parsed.branchId))
    throw new RequestError('Sin acceso a esa organización o sede.', 403);
}

export async function readBranchTimeZone(client: ReaderClient, branchId: string) {
  const { data, error } = await client.from('dc_branches').select('id,time_zone,active').eq('id', branchId);
  if (error) throw new Error('No se pudo leer la sede.');
  const parsed = z
    .array(z.object({ id: z.uuid(), time_zone: z.string(), active: z.boolean() }))
    .parse(data ?? []);
  const branch = parsed.find((b) => b.id === branchId);
  if (!branch || !branch.active) throw new RequestError('La sede no está disponible.', 403);
  return branch.time_zone;
}

async function verifyConversation(client: ReaderClient, conversationId: string) {
  const { data, error } = await client.from('dc_conversations').select('id').eq('id', conversationId);
  if (error) throw new Error('No se pudo verificar la conversación.');
  // RLS only returns conversations the user owns; anything else is denied.
  if (z.array(z.object({ id: z.uuid() })).parse(data ?? []).length === 0)
    throw new RequestError('Conversación no disponible en esta sede.', 403);
  return conversationId;
}

export async function loadConnectedReads(
  client: ReaderClient,
  input: { tenantId: string; branchId: string; conversationId: string; timeZone: string },
): Promise<ConnectedReads> {
  const scoped = (table: string, columns: string) =>
    client.from(table).select(columns).eq('tenant_id', input.tenantId);
  const [professionals, services, offerings, hours, closures, appointments, sources, messages] = await Promise.all([
    scoped('dc_demo_professionals', 'id,name,active'),
    scoped('dc_demo_services', 'id,name,duration_minutes,price_minor,active'),
    scoped('dc_demo_offerings', 'tenant_id,branch_id,professional_id,service_id,active'),
    scoped('dc_demo_business_hours', 'tenant_id,branch_id,weekday,opens_at,closes_at'),
    scoped('dc_demo_closures', 'tenant_id,branch_id,starts_at,ends_at'),
    scoped('dc_demo_appointments', 'id,branch_id,professional_id,service_id,patient_label,starts_at,duration_minutes,status,version'),
    scoped('dc_sources', 'id,branch_id,title,content,content_hash'),
    scoped('dc_messages', 'id,conversation_id,run_id,role,content,result_kind'),
  ]);
  for (const result of [professionals, services, offerings, hours, closures, appointments, sources, messages]) {
    if (result.error) throw new Error('No se pudo leer la sede conectada.');
  }
  const branchOnly = <T extends { branch_id: string }>(rows: T[]) =>
    rows.filter((r) => r.branch_id === input.branchId);
  const appointmentRows = z
    .array(
      z.object({
        id: z.uuid(), branch_id: z.uuid(), professional_id: z.uuid(), service_id: z.uuid(),
        patient_label: z.string(), starts_at: z.string(), duration_minutes: z.number().int(),
        status: z.enum(['scheduled', 'cancelled']), version: z.number().int(),
      }),
    )
    .parse(appointments.data ?? []);
  return {
    catalog: {
      professionals: z.array(z.object({ id: z.uuid(), name: z.string(), active: z.boolean() })).parse(professionals.data ?? []).filter((p) => p.active).map((p) => ({ id: p.id, name: p.name })),
      services: z.array(z.object({ id: z.uuid(), name: z.string(), duration_minutes: z.number().int(), price_minor: z.number().int(), active: z.boolean() })).parse(services.data ?? []).filter((s) => s.active).map((s) => ({ id: s.id, name: s.name, duration: s.duration_minutes, price: s.price_minor })),
      offerings: z.array(z.object({ tenant_id: z.uuid(), branch_id: z.uuid(), professional_id: z.uuid(), service_id: z.uuid(), active: z.boolean() })).parse(offerings.data ?? []).filter((o) => o.active && o.branch_id === input.branchId).map((o) => ({ professionalId: o.professional_id, serviceId: o.service_id })),
      hours: z.array(z.object({ tenant_id: z.uuid(), branch_id: z.uuid(), weekday: z.number().int(), opens_at: z.string(), closes_at: z.string() })).parse(hours.data ?? []).filter((h) => h.branch_id === input.branchId).map((h) => ({ weekday: h.weekday, opens: h.opens_at, closes: h.closes_at })),
      closures: z.array(z.object({ tenant_id: z.uuid(), branch_id: z.uuid(), starts_at: z.string(), ends_at: z.string() })).parse(closures.data ?? []).filter((c) => c.branch_id === input.branchId).map((c) => ({ startsAt: c.starts_at, endsAt: c.ends_at })),
    },
    appointments: branchOnly(appointmentRows).map((a) => mapAppointment(a, input.timeZone)),
    sources: z.array(z.object({ id: z.uuid(), branch_id: z.uuid(), title: z.string(), content: z.string(), content_hash: z.string() })).parse(sources.data ?? []).filter((s) => s.branch_id === input.branchId).map((s) => ({ id: s.id, title: s.title, content: s.content, version: s.content_hash })),
    history: z.array(z.object({ id: z.uuid(), conversation_id: z.uuid(), run_id: z.uuid(), role: z.enum(['user', 'assistant']), content: z.string(), result_kind: z.string().nullable() })).parse(messages.data ?? []).filter((m) => m.conversation_id === input.conversationId).map((m) => ({ role: m.role, content: m.content })),
  };
}

export type ConnectedTurnResult = {
  messages: unknown[];
  proposals: unknown[];
  appointments: unknown[];
  audit: unknown[];
  catalog: {
    doctors: { id: string; name: string; specialty: string }[];
    services: { id: string; name: string; duration: number; price: number }[];
    knowledge: { id: string; title: string; content: string }[];
    hoursNote: string;
    timeZone: string;
  };
  conversationId: string;
  modelReady: boolean;
  today: string;
  terminal: 'published' | 'paused' | 'failed' | 'cancelled';
};

/** Full connected turn: membership → conversation → reads → agent → publish → verified view. */
export async function runConnectedTurn(input: {
  accessToken: string;
  actor: string;
  tenantId: string;
  branchId: string;
  conversationId?: string;
  requestId: string;
  text: string;
  model?: LanguageModel;
  now?: Date;
  abortSignal?: AbortSignal;
  userCancelled?: () => boolean;
  onProgress?: (progress: ChatProgress) => void;
  store?: CopilotStore;
}): Promise<ConnectedTurnResult> {
  const userClient = userSupabase(input.accessToken) as unknown as ReaderClient;
  // Independent read-only checks run together; writes stay strictly ordered below.
  const [, timeZone] = await Promise.all([
    requireBranchAccess(userClient, { tenantId: input.tenantId, branchId: input.branchId }),
    readBranchTimeZone(userClient, input.branchId),
  ]);
  const store = input.store ?? createCopilotStore();
  const conversationId = input.conversationId
    ? await verifyConversation(userClient, input.conversationId)
    : await store.openConversation({ actor: input.actor, tenantId: input.tenantId, branchId: input.branchId });
  const reads = await loadConnectedReads(userClient, {
    tenantId: input.tenantId,
    branchId: input.branchId,
    conversationId,
    timeZone,
  });
  const runId = await store.beginRun({
    actor: input.actor,
    conversationId,
    requestId: input.requestId,
    promptVersion: CONNECTED_PROMPT_VERSION,
    model: process.env.META_MODEL ?? 'muse-spark-1.3',
    text: input.text,
  });
  const outcome = await runSecretaryConnected({
    model: input.model ?? providerModel(),
    reads,
    store,
    actor: input.actor,
    runId,
    timeZone,
    today: clinicToday(input.now),
    text: input.text,
    now: input.now,
    abortSignal: input.abortSignal,
    userCancelled: input.userCancelled,
    onProgress: input.onProgress,
  });
  if (outcome.status !== 'published') {
    const view = await readConnectedContext(userClient, {
      tenantId: input.tenantId,
      branchId: input.branchId,
      conversationId,
      timeZone,
    });
    return {
      messages: view.messages,
      proposals: view.proposals,
      appointments: view.appointments,
      audit: view.audit,
      catalog: {
        doctors: view.doctors,
        services: view.services,
        knowledge: view.knowledge,
        hoursNote: view.hoursNote,
        timeZone,
      },
      conversationId,
      modelReady: true,
      today: clinicToday(input.now),
      terminal: outcome.status,
    };
  }
  const view = await readConnectedContext(userClient, {
    tenantId: input.tenantId,
    branchId: input.branchId,
    conversationId,
    timeZone,
  });
  return {
    messages: view.messages,
    proposals: view.proposals,
    appointments: view.appointments,
    audit: view.audit,
    catalog: {
      doctors: view.doctors,
      services: view.services,
      knowledge: view.knowledge,
      hoursNote: view.hoursNote,
      timeZone,
    },
    conversationId,
    modelReady: true,
    today: clinicToday(input.now),
    terminal: 'published' as const,
  };
}
