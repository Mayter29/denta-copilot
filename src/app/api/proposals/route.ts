import { z } from 'zod';
import { cookies } from 'next/headers';
import { executionReceipt } from '@/lib/domain/results';
import { decide } from '@/lib/domain/agenda';
import { authSession, userSupabase, type CookieStore } from '@/lib/server/auth';
import { readConnectedContext, type ReaderClient } from '@/lib/server/connected-view';
import { requireBranchAccess, readBranchTimeZone } from '@/lib/server/connected-chat';
import { createCopilotStore } from '@/lib/server/copilot-store';
import { isServiceWritesConfigured } from '@/lib/supabase/service';
import {
  apiError,
  boundedJson,
  guardLocal,
  RequestError,
  sessionId,
  withWorkspace,
} from '@/lib/server/workspace';

const schema = z
  .object({ id: z.uuid(), approved: z.boolean(), tenantId: z.uuid().optional(), branchId: z.uuid().optional() })
  .strict();

async function store(): Promise<CookieStore> {
  const jar = await cookies();
  return {
    get: (name) => jar.get(name)?.value,
    set: (name, value, maxAge) =>
      jar.set(name, value, { httpOnly: true, sameSite: 'strict', path: '/', maxAge }),
    clear: (name) => jar.delete(name),
  };
}

export async function POST(request: Request) {
  try {
    guardLocal(request, true);
    const parsed = schema.safeParse(await boundedJson(request));
    if (!parsed.success) throw new RequestError('Propuesta inválida.');
    const { id, approved, tenantId, branchId } = parsed.data;
    const session = tenantId && branchId ? await authSession(await store()).catch(() => null) : null;
    if (session && tenantId && branchId) {
      if (!isServiceWritesConfigured())
        throw new RequestError('La escritura remota no está configurada en este entorno.', 503);
      const userClient = userSupabase(session.accessToken) as unknown as ReaderClient;
      await requireBranchAccess(userClient, { tenantId, branchId });
      const decided = await createCopilotStore().decideDemoProposal({
        actor: session.userId,
        proposalId: id,
        approved,
      });
      // The proposal row reveals its conversation; ownership is enforced by RLS + the RPC.
      const proposal = await userClient.from('dc_proposals').select('id,conversation_id').eq('id', id);
      if (proposal.error) throw new Error('No se pudo leer la propuesta decidida.');
      const row = z.array(z.object({ id: z.uuid(), conversation_id: z.uuid() })).parse(proposal.data ?? [])[0];
      if (!row) throw new RequestError('La propuesta ya no está disponible.', 404);
      const timeZone = await readBranchTimeZone(userClient, branchId);
      const view = await readConnectedContext(userClient, {
        tenantId,
        branchId,
        conversationId: row.conversation_id,
        timeZone,
      });
      const confirmed = view.proposals.find((p) => p.id === id);
      return Response.json({
        receipt: confirmed?.receipt ?? null,
        status: decided.status,
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
        conversationId: row.conversation_id,
      });
    }
    if ((tenantId || branchId) && !session)
      throw new RequestError('Sesión vencida. Volvé a ingresar.', 401);
    return await withWorkspace(await sessionId(), (state) => {
      decide(state, parsed.data.id, parsed.data.approved);
      return Response.json({
        receipt: executionReceipt(state, parsed.data.id),
        messages: state.messages,
        appointments: state.appointments,
        proposals: state.proposals,
        audit: state.audit,
      });
    });
  } catch (error) {
    return apiError(error);
  }
}
