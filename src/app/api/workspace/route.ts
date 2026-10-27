import { apiError, guardLocal, sessionId, withWorkspace } from '@/lib/server/workspace';
import { clinicToday, doctors, services } from '@/lib/domain/types';
import { knowledge } from '@/lib/domain/knowledge';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    guardLocal(request);
    const id = await sessionId(true);
    return await withWorkspace(id, (state) =>
      Response.json(
        {
          ...state,
          doctors,
          services,
          knowledge,
          today: clinicToday(),
          modelReady: !!(
            (process.env.META_API_KEY || process.env.MODEL_API_KEY) &&
            process.env.META_MODEL
          ),
        },
        { headers: { 'Cache-Control': 'no-store' } },
      ),
    );
  } catch (error) {
    return apiError(error);
  }
}
