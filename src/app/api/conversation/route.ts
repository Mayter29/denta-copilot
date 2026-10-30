import { z } from 'zod';
import { apiError, guardLocal, RequestError } from '@/lib/server/workspace';
import { authSession } from '@/lib/server/auth';
import { routeCookieStore } from '@/lib/server/cookies';
import { loadSessionContext, readerFor, validSelection } from '@/lib/server/session-context';
import { readBranchCatalog, readConversationView } from '@/lib/server/connected-view';
import { readBranchTimeZone } from '@/lib/server/connected-chat';
export const runtime = 'nodejs';

const querySchema = z.object({
  tenantId: z.uuid(),
  branchId: z.uuid(),
  conversationId: z.uuid().optional(),
});

export async function GET(request: Request) {
  try {
    guardLocal(request);
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      tenantId: url.searchParams.get('tenantId') ?? undefined,
      branchId: url.searchParams.get('branchId') ?? undefined,
      conversationId: url.searchParams.get('conversationId') ?? undefined,
    });
    if (!parsed.success) throw new RequestError('Parámetros inválidos.', 400);
    const session = await authSession(await routeCookieStore());
    if (!session) throw new RequestError('Sesión vencida. Volvé a ingresar.', 401);
    const context = await loadSessionContext(session);
    const selection = validSelection(context.contexts, parsed.data);
    if (!selection) throw new RequestError('Sin acceso a esa organización o sede.', 403);
    const reader = readerFor(session);
    const timeZone = await readBranchTimeZone(reader, selection.branchId);
    const catalog = await readBranchCatalog(reader, { tenantId: selection.tenantId });
    if (!parsed.data.conversationId) {
      return Response.json({ messages: [], proposals: [], audit: [], ...catalog, conversationId: null });
    }
    const view = await readConversationView(reader, {
      tenantId: selection.tenantId,
      branchId: selection.branchId,
      conversationId: parsed.data.conversationId,
      timeZone,
    });
    return Response.json({ ...view, ...catalog, conversationId: parsed.data.conversationId });
  } catch (error) {
    return apiError(error);
  }
}
