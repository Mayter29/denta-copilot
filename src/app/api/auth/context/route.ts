import { z } from 'zod';
import { apiError, boundedJson, guardLocal, RequestError } from '@/lib/server/workspace';
import { authSession } from '@/lib/server/auth';
import { CONTEXT_COOKIE, encodeSelection, routeCookieStore } from '@/lib/server/cookies';
import { loadSessionContext, validSelection } from '@/lib/server/session-context';
export const runtime = 'nodejs';

const schema = z.object({ tenantId: z.uuid(), branchId: z.uuid() }).strict();

/** Persists the selected org/branch after validating it against authorized contexts. */
export async function POST(request: Request) {
  try {
    guardLocal(request, true);
    const parsed = schema.safeParse(await boundedJson(request));
    if (!parsed.success) throw new RequestError('Selección inválida.', 400);
    const store = await routeCookieStore();
    const session = await authSession(store);
    if (!session) throw new RequestError('Sesión vencida. Volvé a ingresar.', 401);
    const context = await loadSessionContext(session);
    const selection = validSelection(context.contexts, parsed.data);
    if (!selection) throw new RequestError('Sin acceso a esa organización o sede.', 403);
    if (!context.serviceWrites) {
      return Response.json(
        {
          error:
            'Configuración de escritura no disponible en el servidor. No se activó ninguna agenda local.',
        },
        { status: 503 },
      );
    }
    const { cookies } = await import('next/headers');
    const jar = await cookies();
    jar.set(CONTEXT_COOKIE, encodeSelection(parsed.data), {
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
    return Response.json({ selection });
  } catch (error) {
    return apiError(error);
  }
}
