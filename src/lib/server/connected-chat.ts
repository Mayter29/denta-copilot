import 'server-only';
import { z } from 'zod';
import type { LanguageModel } from 'ai';
import { providerModel } from './agent';
import { clinicToday } from '../domain/types';
import { phaseProgress, type ChatProgress } from '../domain/chat-progress';
import type { ChatDelta } from '../domain/chat-delta';
import { createCopilotStore, type CopilotStore } from './copilot-store';
import {
  asReaderClient,
  readAgentContext,
  readRunDelta,
  type ReaderClient,
} from './connected-view';
import {
  CONNECTED_PROMPT_VERSION,
  runSecretaryConnected,
  type ConnectedReads,
} from './supabase-agent';
import { createTurnTimer, logTurn } from './timing';
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
  const { data, error } = await client
    .from('dc_branches')
    .select('id,time_zone,active')
    .eq('id', branchId);
  if (error) throw new Error('No se pudo leer la sede.');
  const parsed = z
    .array(z.object({ id: z.uuid(), time_zone: z.string(), active: z.boolean() }))
    .parse(data ?? []);
  const branch = parsed.find((b) => b.id === branchId);
  if (!branch || !branch.active) throw new RequestError('La sede no está disponible.', 403);
  return branch.time_zone;
}

async function verifyConversation(client: ReaderClient, conversationId: string) {
  const { data, error } = await client
    .from('dc_conversations')
    .select('id')
    .eq('id', conversationId);
  if (error) throw new Error('No se pudo verificar la conversación.');
  // RLS only returns conversations the user owns; anything else is denied.
  if (z.array(z.object({ id: z.uuid() })).parse(data ?? []).length === 0)
    throw new RequestError('Conversación no disponible en esta sede.', 403);
  return conversationId;
}

/** @deprecated Use readAgentContext with an explicit run; kept for the legacy workspace read. */
export async function loadConnectedReads(
  client: ReaderClient,
  input: { tenantId: string; branchId: string; conversationId: string; timeZone: string },
): Promise<ConnectedReads> {
  return readAgentContext(client, {
    ...input,
    runId: '00000000-0000-0000-0000-000000000000',
    today: clinicToday(),
  });
}

export type ConnectedTurnResult = {
  delta: ChatDelta;
  conversationId: string;
  modelReady: boolean;
  today: string;
  terminal: ChatDelta['terminal'];
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
  const timer = createTurnTimer();
  const userClient = asReaderClient(userSupabase(input.accessToken));
  // Independent read-only checks run together; writes stay strictly ordered below.
  const [, timeZone] = await Promise.all([
    requireBranchAccess(userClient, { tenantId: input.tenantId, branchId: input.branchId }),
    readBranchTimeZone(userClient, input.branchId),
  ]);
  timer.checkpoint('authorization');
  const store = input.store ?? createCopilotStore();
  const conversationId = input.conversationId
    ? await verifyConversation(userClient, input.conversationId)
    : await store.openConversation({
        actor: input.actor,
        tenantId: input.tenantId,
        branchId: input.branchId,
      });
  // The run persists the current user message first; history reads exclude this run,
  // so the message can never be duplicated in the prompt.
  const runId = await store.beginRun({
    actor: input.actor,
    conversationId,
    requestId: input.requestId,
    promptVersion: CONNECTED_PROMPT_VERSION,
    model: process.env.META_MODEL ?? 'muse-spark-1.3',
    text: input.text,
  });
  timer.checkpoint('run');
  input.onProgress?.(phaseProgress('context'));
  let outcome: Awaited<ReturnType<typeof runSecretaryConnected>>;
  try {
    const reads = await readAgentContext(userClient, {
      tenantId: input.tenantId,
      branchId: input.branchId,
      conversationId,
      runId,
      timeZone,
      today: clinicToday(input.now),
    });
    timer.checkpoint('reads');
    outcome = await runSecretaryConnected({
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
      timer,
    });
  } catch (error) {
    // Context/provider setup can fail before the agent owns run finalization.
    // Close the persisted run so retries cannot leave an active turn stranded.
    const status = input.abortSignal?.aborted
      ? input.userCancelled?.()
        ? 'cancelled'
        : 'paused'
      : 'failed';
    try {
      await store.abortRun({ actor: input.actor, runId, status });
    } catch {
      logTurn('chat-cleanup-failed', { runId });
    }
    throw error;
  }
  const delta = await readRunDelta(userClient, {
    tenantId: input.tenantId,
    branchId: input.branchId,
    conversationId,
    runId,
    timeZone,
    terminal: outcome.status,
  });
  timer.checkpoint('response');
  delta.timing = timer.summary();
  logTurn('chat-turn', {
    requestId: input.requestId,
    runId,
    mode: 'connected',
    terminal: outcome.status,
    totalMs: Math.round(delta.timing.totalMs),
    steps: delta.timing.steps,
    modelCalls: delta.timing.modelCalls,
    inputTokens: delta.timing.inputTokens,
    outputTokens: delta.timing.outputTokens,
  });
  return {
    delta,
    conversationId,
    modelReady: true,
    today: clinicToday(input.now),
    terminal: outcome.status,
  };
}
