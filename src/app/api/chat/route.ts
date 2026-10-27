import { z } from 'zod';
import { runSecretary } from '@/lib/server/agent';
import {
  apiError,
  boundedJson,
  guardLocal,
  RequestError,
  sessionId,
  withWorkspace,
} from '@/lib/server/workspace';
export const runtime = 'nodejs';
export const maxDuration = 60;
const inputSchema = z.strictObject({ text: z.string().trim().min(1).max(2000) });
export async function POST(request: Request) {
  try {
    guardLocal(request, true);
    const parsed = inputSchema.safeParse(await boundedJson(request));
    if (!parsed.success) throw new RequestError('Escribí un mensaje de hasta 2000 caracteres.');
    const id = await sessionId();
    return await withWorkspace(id, async (state) => {
      if (state.messages.length >= 80)
        throw new RequestError('Alcanzaste el límite de esta sesión de demo.', 429);
      await runSecretary(state, parsed.data.text, {
        abortSignal: AbortSignal.any([request.signal, AbortSignal.timeout(55_000)]),
      });
      return Response.json({
        messages: state.messages,
        proposals: state.proposals,
        appointments: state.appointments,
        patientThread: state.patientThread,
        audit: state.audit,
      });
    });
  } catch (error) {
    return apiError(error);
  }
}
