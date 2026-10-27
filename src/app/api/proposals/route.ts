import { z } from 'zod';
import { executionReceipt } from '@/lib/domain/results';
import { decide } from '@/lib/domain/agenda';
import {
  apiError,
  boundedJson,
  guardLocal,
  RequestError,
  sessionId,
  withWorkspace,
} from '@/lib/server/workspace';
const schema = z.object({ id: z.uuid(), approved: z.boolean() }).strict();
export async function POST(request: Request) {
  try {
    guardLocal(request, true);
    const parsed = schema.safeParse(await boundedJson(request));
    if (!parsed.success) throw new RequestError('Propuesta inválida.');
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
