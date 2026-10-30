import { z } from 'zod';
import { apiError, guardLocal, RequestError } from '@/lib/server/workspace';
import { authSession } from '@/lib/server/auth';
import { routeCookieStore } from '@/lib/server/cookies';
import { loadSessionContext, readerFor, validSelection } from '@/lib/server/session-context';
import { readDayAgenda } from '@/lib/server/connected-view';
import { readBranchTimeZone } from '@/lib/server/connected-chat';
export const runtime = 'nodejs';

const querySchema = z.object({
  tenantId: z.uuid(),
  branchId: z.uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(request: Request) {
  try {
    guardLocal(request);
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      tenantId: url.searchParams.get('tenantId') ?? undefined,
      branchId: url.searchParams.get('branchId') ?? undefined,
      date: url.searchParams.get('date') ?? undefined,
    });
    if (!parsed.success) throw new RequestError('Parámetros inválidos.', 400);
    const session = await authSession(await routeCookieStore());
    if (!session) throw new RequestError('Sesión vencida. Volvé a ingresar.', 401);
    const context = await loadSessionContext(session);
    const selection = validSelection(context.contexts, parsed.data);
    if (!selection) throw new RequestError('Sin acceso a esa organización o sede.', 403);
    const reader = readerFor(session);
    const timeZone = await readBranchTimeZone(reader, selection.branchId);
    const agenda = await readDayAgenda(reader, {
      tenantId: selection.tenantId,
      branchId: selection.branchId,
      date: parsed.data.date,
      timeZone,
    });
    return Response.json({ ...agenda, date: parsed.data.date, timeZone });
  } catch (error) {
    return apiError(error);
  }
}
