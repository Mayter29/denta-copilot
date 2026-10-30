import { z } from 'zod';
import { patientReply, patientReplySummary } from '@/lib/domain/agenda';
import {
  apiError,
  boundedJson,
  guardLocal,
  RequestError,
  sessionId,
  withWorkspace,
} from '@/lib/server/workspace';

export const runtime = 'nodejs';

const schema = z
  .object({
    appointmentId: z.string().min(1).max(100),
    reply: z.enum(['confirm', 'reschedule', 'cancel']),
  })
  .strict();

/**
 * Simulated patient channel (local demo only, fictitious data).
 * Confirm updates attendance; reschedule/cancel only leave a message.
 * The agenda itself still changes exclusively through human-confirmed proposals.
 */
export async function POST(request: Request) {
  try {
    guardLocal(request, true);
    const parsed = schema.safeParse(await boundedJson(request));
    if (!parsed.success) throw new RequestError('Respuesta inválida.');
    const { appointmentId, reply } = parsed.data;
    return await withWorkspace(await sessionId(), (state) => {
      const message = patientReply(state, appointmentId, reply, new Date());
      const appointment = state.appointments.find((a) => a.id === appointmentId);
      return Response.json({
        message,
        summary: patientReplySummary(reply, message.patient),
        appointments: appointment ? [appointment] : [],
        patientThread: state.patientThread,
        audit: state.audit,
      });
    });
  } catch (error) {
    return apiError(error);
  }
}
