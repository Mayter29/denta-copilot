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
    if (!parsed.success) throw new RequestError('Write a message of up to 2000 characters.');
    const id = await sessionId();
    return await withWorkspace(id, async (state) => {
      if (state.messages.length >= 80)
        throw new RequestError('This demo session reached its message limit.', 429);
      await runSecretary(state, parsed.data.text, {
        abortSignal: AbortSignal.any([request.signal, AbortSignal.timeout(55_000)]),
      });
      return Response.json({
        messages: state.messages,
        proposals: state.proposals,
        appointments: state.appointments,
        patientMessages: state.patientMessages,
        audit: state.audit,
      });
    });
  } catch (error) {
    return apiError(error);
  }
}
