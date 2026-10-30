import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { runSecretary } from '@/lib/server/agent';
import type { ChatProgress } from '@/lib/domain/chat-progress';
import { DomainError } from '@/lib/domain/agenda';
import { authSession, type CookieStore } from '@/lib/server/auth';
import { runConnectedTurn } from '@/lib/server/connected-chat';
import { isServiceWritesConfigured } from '@/lib/supabase/service';
import {
  apiError,
  boundedJson,
  guardLocal,
  RequestError,
  sessionId,
  withWorkspace,
} from '@/lib/server/workspace';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const maxDuration = 60;
const inputSchema = z
  .object({
    text: z.string().trim().min(1).max(2000),
    tenantId: z.uuid().optional(),
    branchId: z.uuid().optional(),
    conversationId: z.uuid().optional(),
    requestId: z.uuid().optional(),
  })
  .strict();

function safeMessage(error: unknown): { message: string; status: number } {
  if (error instanceof RequestError) return { message: error.message, status: error.status };
  if (error instanceof DomainError) return { message: error.message, status: 409 };
  return {
    message: 'No se pudo completar la operación. Revisá la conexión y volvé a intentar.',
    status: 502,
  };
}

async function cookieStore(): Promise<CookieStore> {
  const jar = await cookies();
  return {
    get: (name) => jar.get(name)?.value,
    set: (name, value, maxAge) =>
      jar.set(name, value, { httpOnly: true, sameSite: 'strict', path: '/', maxAge }),
    clear: (name) => jar.delete(name),
  };
}

export async function POST(request: Request) {
  try {
    guardLocal(request, true);
    const parsed = inputSchema.safeParse(await boundedJson(request));
    if (!parsed.success) throw new RequestError('Escribí un mensaje de hasta 2000 caracteres.');
    const { text, tenantId, branchId } = parsed.data;
    const conversationId = parsed.data.conversationId;
    const requestId = parsed.data.requestId ?? randomUUID();
    const id = await sessionId();
    const timeout = AbortSignal.timeout(55_000);
    const combined = AbortSignal.any([request.signal, timeout]);

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const send = (event: string, data: unknown) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        };
        let lastId = '';
        const onProgress = (progress: ChatProgress) => {
          if (combined.aborted || progress.id === lastId) return;
          lastId = progress.id;
          send('progress', progress);
        };
        try {
          // Connected mode is explicit: verified session + org/branch selection + service key.
          // Anything else keeps the local demo flow; Supabase failures are never hidden behind it.
          const session = tenantId && branchId ? await authSession(await cookieStore()).catch(() => null) : null;
          if (session && tenantId && branchId) {
            if (!isServiceWritesConfigured())
              throw new RequestError(
                'La escritura remota no está configurada en este entorno. La demo local sigue disponible sin sede.',
                503,
              );
            const connected = await runConnectedTurn({
              accessToken: session.accessToken,
              actor: session.userId,
              tenantId,
              branchId,
              conversationId,
              requestId,
              text,
              abortSignal: combined,
              userCancelled: () => request.signal.aborted,
              onProgress,
            });
            if (!combined.aborted) send('final', connected);
          } else {
            if ((tenantId || branchId || conversationId) && !session)
              throw new RequestError('Sesión vencida. Volvé a ingresar.', 401);
            const finalState = await withWorkspace(id, async (state) => {
              if (state.messages.length >= 80)
                throw new RequestError('Alcanzaste el límite de esta sesión de demo.', 429);
              await runSecretary(state, text, { abortSignal: combined, onProgress });
              return {
                messages: state.messages,
                proposals: state.proposals,
                appointments: state.appointments,
                audit: state.audit,
              };
            });
            if (!combined.aborted) send('final', finalState);
          }
        } catch (error) {
          if (!combined.aborted) {
            const { message } = safeMessage(error);
            send('error', { error: message });
          }
        } finally {
          controller.close();
        }
      },
      cancel() {
        // Client disconnect: turns observe request.signal via `combined`.
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
