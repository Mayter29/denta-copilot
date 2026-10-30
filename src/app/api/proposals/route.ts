import { z } from 'zod';
import { executionReceipt } from '@/lib/domain/results';
import { decide } from '@/lib/domain/agenda';
import { authSession } from '@/lib/server/auth';
import { routeCookieStore } from '@/lib/server/cookies';
import { readDecisionDelta } from '@/lib/server/connected-view';
import { loadSessionContext, readerFor, validSelection } from '@/lib/server/session-context';
import { readBranchTimeZone } from '@/lib/server/connected-chat';
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

export async function POST(request: Request) {
  try {
    guardLocal(request, true);
    const parsed = schema.safeParse(await boundedJson(request));
    if (!parsed.success) throw new RequestError('Propuesta inválida.');
    const { id, approved, tenantId, branchId } = parsed.data;
    const session = tenantId && branchId ? await authSession(await routeCookieStore()).catch(() => null) : null;
    if (session && tenantId && branchId) {
      if (!isServiceWritesConfigured())
        throw new RequestError('La escritura remota no está configurada en este entorno.', 503);
      const context = await loadSessionContext(session);
      const selection = validSelection(context.contexts, { tenantId, branchId });
      if (!selection) throw new RequestError('Sin acceso a esa organización o sede.', 403);
      const decided = await createCopilotStore().decideDemoProposal({
        actor: session.userId,
        proposalId: id,
        approved,
      });
      const reader = readerFor(session);
      const timeZone = await readBranchTimeZone(reader, branchId);
      const delta = await readDecisionDelta(reader, { tenantId, branchId, proposalId: id, timeZone });
      const confirmed = delta.proposals.find((p) => p.id === id);
      return Response.json({
        ...delta,
        receipt: confirmed?.receipt ?? null,
        status: decided.status,
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
