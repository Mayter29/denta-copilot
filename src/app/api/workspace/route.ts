import { apiError, guardLocal, sessionId, withWorkspace } from '@/lib/server/workspace';
import { availableSlots } from '@/lib/domain/agenda';
import { getDailyInsights } from '@/lib/domain/insights';
import { clinicToday } from '@/lib/domain/types';
export const runtime = 'nodejs';

/** Local demo state only. Connected areas use /api/conversation, /api/agenda and /api/knowledge. */
export async function GET(request: Request) {
  try {
    guardLocal(request);
    const id = await sessionId(true);
    return await withWorkspace(id, (state) => {
      const today = clinicToday();
      const now = new Date();
      const insights = getDailyInsights(state.appointments, today, (date, doctorId, serviceId) =>
        availableSlots(state, date, doctorId, serviceId, now),
      );
      return Response.json(
        {
          ...state,
          catalog: null,
          conversationId: null,
          connected: false,
          today,
          insights,
          modelReady: !!((process.env.META_API_KEY || process.env.MODEL_API_KEY) && process.env.META_MODEL),
        },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    });
  } catch (error) {
    return apiError(error);
  }
}
