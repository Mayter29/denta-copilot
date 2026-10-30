import { z } from 'zod';
import { cookies } from 'next/headers';
import { apiError, guardLocal, RequestError, sessionId, withWorkspace } from '@/lib/server/workspace';
import { authSession, userSupabase, type CookieStore } from '@/lib/server/auth';
import { readConnectedContext, type ReaderClient } from '@/lib/server/connected-view';
import { requireBranchAccess, readBranchTimeZone } from '@/lib/server/connected-chat';
import { isServiceWritesConfigured } from '@/lib/supabase/service';
import { clinicToday } from '@/lib/domain/types';
export const runtime = 'nodejs';

const querySchema = z.object({
  tenantId: z.uuid().optional(),
  branchId: z.uuid().optional(),
  conversationId: z.uuid().optional(),
});

async function store(): Promise<CookieStore> {
  const jar = await cookies();
  return { get: (name) => jar.get(name)?.value, set: () => {}, clear: () => {} };
}

export async function GET(request: Request) {
  try {
    guardLocal(request);
    const url = new URL(request.url);
    const query = querySchema.safeParse({
      tenantId: url.searchParams.get('tenantId') ?? undefined,
      branchId: url.searchParams.get('branchId') ?? undefined,
      conversationId: url.searchParams.get('conversationId') ?? undefined,
    });
    if (!query.success) throw new RequestError('Parámetros inválidos.', 400);
    const { tenantId, branchId, conversationId } = query.data;
    if (tenantId && branchId) {
      const session = await authSession(await store()).catch(() => null);
      if (!session) throw new RequestError('Sesión vencida. Volvé a ingresar.', 401);
      if (!isServiceWritesConfigured())
        throw new RequestError('La escritura remota no está configurada en este entorno.', 503);
      const userClient = userSupabase(session.accessToken) as unknown as ReaderClient;
      await requireBranchAccess(userClient, { tenantId, branchId });
      const timeZone = await readBranchTimeZone(userClient, branchId);
      if (!conversationId) {
        // Agenda visible sin abrir conversación: no se crea nada remoto en una lectura.
        const { loadConnectedReads } = await import('@/lib/server/connected-chat');
        const reads = await loadConnectedReads(userClient, {
          tenantId,
          branchId,
          conversationId: '00000000-0000-0000-0000-000000000000',
          timeZone,
        });
        return Response.json(
          {
            messages: [],
            proposals: [],
            appointments: reads.appointments,
            audit: [],
            catalog: {
              doctors: reads.catalog.professionals.map((p) => ({ id: p.id, name: p.name, specialty: 'Odontología general' })),
              services: reads.catalog.services.map((s) => ({ id: s.id, name: s.name, duration: s.duration, price: s.price })),
              knowledge: reads.sources.map((s) => ({ id: s.id, title: s.title, content: s.content })),
              hoursNote: '',
              timeZone,
            },
            conversationId: null,
            today: clinicToday(),
            modelReady: !!((process.env.META_API_KEY || process.env.MODEL_API_KEY) && process.env.META_MODEL),
            connected: true,
          },
          { headers: { 'Cache-Control': 'no-store' } },
        );
      }
      const view = await readConnectedContext(userClient, { tenantId, branchId, conversationId, timeZone });
      return Response.json(
        {
          messages: view.messages,
          proposals: view.proposals,
          appointments: view.appointments,
          audit: view.audit,
          catalog: {
            doctors: view.doctors,
            services: view.services,
            knowledge: view.knowledge,
            hoursNote: view.hoursNote,
            timeZone,
          },
          conversationId,
          today: clinicToday(),
          modelReady: !!((process.env.META_API_KEY || process.env.MODEL_API_KEY) && process.env.META_MODEL),
          connected: true,
        },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }
    const id = await sessionId(true);
    return await withWorkspace(id, (state) =>
      Response.json(
        {
          ...state,
          catalog: null,
          conversationId: null,
          connected: false,
          today: clinicToday(),
          modelReady: !!((process.env.META_API_KEY || process.env.MODEL_API_KEY) && process.env.META_MODEL),
        },
        { headers: { 'Cache-Control': 'no-store' } },
      ),
    );
  } catch (error) {
    return apiError(error);
  }
}
