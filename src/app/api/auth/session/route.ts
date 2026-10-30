import { apiError, guardLocal } from '@/lib/server/workspace';
import { authSession } from '@/lib/server/auth';
import { routeCookieStore } from '@/lib/server/cookies';
import { loadSessionContext } from '@/lib/server/session-context';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    guardLocal(request);
    const session = await authSession(await routeCookieStore());
    if (!session) return Response.json({ authenticated: false as const });
    const context = await loadSessionContext(session);
    return Response.json({
      authenticated: true as const,
      userId: context.userId,
      contexts: context.contexts,
      serviceWrites: context.serviceWrites,
      patient: context.patient,
    });
  } catch (error) {
    return apiError(error);
  }
}
