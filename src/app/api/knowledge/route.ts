import { z } from 'zod';
import { apiError, guardLocal, RequestError } from '@/lib/server/workspace';
import { authSession } from '@/lib/server/auth';
import { routeCookieStore } from '@/lib/server/cookies';
import { loadSessionContext, readerFor, validSelection } from '@/lib/server/session-context';
import { readBranchKnowledge } from '@/lib/server/connected-view';
export const runtime = 'nodejs';

const querySchema = z.object({ tenantId: z.uuid(), branchId: z.uuid() });

export async function GET(request: Request) {
  try {
    guardLocal(request);
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      tenantId: url.searchParams.get('tenantId') ?? undefined,
      branchId: url.searchParams.get('branchId') ?? undefined,
    });
    if (!parsed.success) throw new RequestError('Parámetros inválidos.', 400);
    const session = await authSession(await routeCookieStore());
    if (!session) throw new RequestError('Sesión vencida. Volvé a ingresar.', 401);
    const context = await loadSessionContext(session);
    const selection = validSelection(context.contexts, parsed.data);
    if (!selection) throw new RequestError('Sin acceso a esa organización o sede.', 403);
    const knowledge = await readBranchKnowledge(readerFor(session), {
      tenantId: selection.tenantId,
      branchId: selection.branchId,
    });
    return Response.json({ knowledge });
  } catch (error) {
    return apiError(error);
  }
}
