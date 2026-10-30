import 'server-only';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DomainError } from '../domain/agenda';
import { createServiceClient, ServiceWritesUnavailable } from '../supabase/service';
import { RequestError } from './workspace';

const uuid = z.uuid();
const actorSchema = uuid;
const tenantSchema = uuid;
const branchSchema = uuid;

// SQLSTATE raised by the migration for authorization failures.
const ACCESS_DENIED = '42501';
// Optimistic-concurrency and race signals mapped to 409 so the UI can retry explicitly.
const CONFLICT_CODES = new Set(['40001', '23P01', '40000', '55000', '54000']);

export type StoreClient = Pick<SupabaseClient, 'rpc'>;

function storeError(error: { code?: string; message?: string }, action: string): Error {
  const message = error.message ?? '';
  if (error.code === ACCESS_DENIED || message.includes('access_denied'))
    return new RequestError('Sin acceso a esa organización o sede.', 403);
  if (message.includes('invalid_run_input') || message.includes('invalid_result'))
    return new RequestError('El turno no pasó la validación del servidor.', 422);
  if (
    (error.code && CONFLICT_CODES.has(error.code)) ||
    /stale_appointment|slot_conflict|catalog_changed|run_already_active|run_is_terminal|proposal_not_published|decision_already_taken|idempotency_mismatch|outside_business_hours|branch_closed|start_time_passed|proposal_limit|event_limit/.test(
      message,
    )
  )
    return new DomainError(`${action}: ${shortCode(message)}`);
  return new Error(`No se pudo completar ${action}.`);
}

function shortCode(message: string) {
  const code = message.split(' ').find((part) => /^[a-z_]+$/.test(part));
  return code ?? 'la operación';
}

async function call<T>(
  client: StoreClient,
  fn: string,
  args: Record<string, unknown>,
  action: string,
): Promise<T> {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw storeError(error, action);
  return data as T;
}

/** Server-owned persistence behind the 8 service-role RPCs. Actor always comes from a verified session. */
export function createCopilotStore(client: StoreClient = createServiceClient()) {
  return {
    async openConversation(input: { actor: string; tenantId: string; branchId: string }) {
      const parsed = z
        .object({ actor: actorSchema, tenantId: tenantSchema, branchId: branchSchema })
        .parse(input);
      return call<string>(client, 'dc_open_conversation', {
        p_actor: parsed.actor,
        p_tenant: parsed.tenantId,
        p_branch: parsed.branchId,
      }, 'abrir la conversación');
    },
    async beginRun(input: {
      actor: string;
      conversationId: string;
      requestId: string;
      promptVersion: string;
      model: string;
      text: string;
    }) {
      const parsed = z
        .object({
          actor: actorSchema,
          conversationId: uuid,
          requestId: uuid,
          promptVersion: z.string().min(1).max(100),
          model: z.string().min(1).max(100),
          text: z.string().trim().min(1).max(2000),
        })
        .parse(input);
      return call<string>(client, 'dc_begin_run', {
        p_actor: parsed.actor,
        p_conversation: parsed.conversationId,
        p_request: parsed.requestId,
        p_prompt_version: parsed.promptVersion,
        p_model: parsed.model,
        p_text: parsed.text,
      }, 'iniciar el turno');
    },
    async recordToolEvent(input: { actor: string; runId: string; callId: string; tool: string; kind: 'started' | 'completed' }) {
      const parsed = z
        .object({
          actor: actorSchema,
          runId: uuid,
          callId: z.string().min(1).max(100),
          tool: z.enum([
            'listAppointments',
            'findAvailability',
            'searchKnowledge',
            'proposeBooking',
            'proposeCancellation',
            'proposeReschedule',
          ]),
          kind: z.enum(['started', 'completed']),
        })
        .parse(input);
      await call(client, 'dc_record_tool_event', {
        p_actor: parsed.actor,
        p_run: parsed.runId,
        p_call: parsed.callId,
        p_tool: parsed.tool,
        p_kind: parsed.kind,
      }, 'registrar la herramienta');
    },
    async recordSource(input: { actor: string; runId: string; sourceId: string }) {
      const parsed = z.object({ actor: actorSchema, runId: uuid, sourceId: uuid }).parse(input);
      await call(client, 'dc_record_source', {
        p_actor: parsed.actor,
        p_run: parsed.runId,
        p_source: parsed.sourceId,
      }, 'registrar la fuente');
    },
    async publishRun(input: {
      actor: string;
      runId: string;
      kind: 'answer' | 'needs_input' | 'proposal';
      text: string;
      proposalIds: string[];
      sourceIds: string[];
    }) {
      const parsed = z
        .object({
          actor: actorSchema,
          runId: uuid,
          kind: z.enum(['answer', 'needs_input', 'proposal']),
          text: z.string().trim().min(1).max(2000),
          proposalIds: z.array(uuid).max(20),
          sourceIds: z.array(uuid).max(5),
        })
        .parse(input);
      return call<{ kind: string; text: string; execution: string; proposal_ids: string[]; source_ids: string[] }>(
        client,
        'dc_publish_run',
        {
          p_actor: parsed.actor,
          p_run: parsed.runId,
          p_kind: parsed.kind,
          p_text: parsed.text,
          p_proposals: parsed.proposalIds,
          p_sources: parsed.sourceIds,
        },
        'publicar el turno',
      );
    },
    async abortRun(input: { actor: string; runId: string; status: 'failed' | 'paused' | 'cancelled' }) {
      const parsed = z
        .object({ actor: actorSchema, runId: uuid, status: z.enum(['failed', 'paused', 'cancelled']) })
        .parse(input);
      await call(client, 'dc_abort_run', {
        p_actor: parsed.actor,
        p_run: parsed.runId,
        p_status: parsed.status,
      }, 'cerrar el turno');
    },
    async proposeDemoAppointment(input: {
      actor: string;
      runId: string;
      requestId: string;
      operation: 'book' | 'cancel' | 'reschedule';
      patient?: string;
      professionalId?: string;
      serviceId?: string;
      startsAt?: string;
      appointmentId?: string;
      expectedVersion?: number;
    }) {
      const parsed = z
        .object({
          actor: actorSchema,
          runId: uuid,
          requestId: uuid,
          operation: z.enum(['book', 'cancel', 'reschedule']),
          patient: z.string().trim().min(2).max(120).optional(),
          professionalId: uuid.optional(),
          serviceId: uuid.optional(),
          startsAt: z.string().datetime({ offset: true }).optional(),
          appointmentId: uuid.optional(),
          expectedVersion: z.number().int().positive().optional(),
        })
        .parse(input);
      return call<string>(client, 'dc_propose_demo_appointment', {
        p_actor: parsed.actor,
        p_run: parsed.runId,
        p_request: parsed.requestId,
        p_operation: parsed.operation,
        p_patient: parsed.patient ?? null,
        p_professional: parsed.professionalId ?? null,
        p_service: parsed.serviceId ?? null,
        p_start: parsed.startsAt ?? null,
        p_appointment: parsed.appointmentId ?? null,
        p_expected_version: parsed.expectedVersion ?? null,
      }, 'preparar la propuesta');
    },
    async decideDemoProposal(input: { actor: string; proposalId: string; approved: boolean }) {
      const parsed = z
        .object({ actor: actorSchema, proposalId: uuid, approved: z.boolean() })
        .parse(input);
      return call<{ status: string; receipt: Record<string, unknown> | null }>(
        client,
        'dc_decide_demo_proposal',
        { p_actor: parsed.actor, p_proposal: parsed.proposalId, p_approved: parsed.approved },
        'decidir la propuesta',
      );
    },
  };
}

export type CopilotStore = ReturnType<typeof createCopilotStore>;
export { ServiceWritesUnavailable };
