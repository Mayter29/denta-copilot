import { checkSupabaseConnection } from '@/lib/supabase/server';
import { SUPABASE_PROJECT_REF } from '@/lib/supabase/config';
import { apiError, guardLocal, RequestError } from '@/lib/server/workspace';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    guardLocal(request);
    if (!(await checkSupabaseConnection())) {
      throw new RequestError('Could not verify the Supabase connection for Denta.', 503);
    }
    return Response.json(
      {
        connected: true,
        projectRef: SUPABASE_PROJECT_REF,
        check: 'auth-api-key-accepted',
        workspaceStorage: 'local-demo',
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return apiError(error);
  }
}
