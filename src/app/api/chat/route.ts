import { z } from 'zod';
import { runSecretary } from '@/lib/server/agent';
import type { ChatProgress } from '@/lib/domain/chat-progress';
import { DomainError } from '@/lib/domain/agenda';
import {
  boundedJson,
  guardLocal,
  RequestError,
  sessionId,
  withWorkspace,
} from '@/lib/server/workspace';

export const runtime = 'nodejs';
export const maxDuration = 60;
const inputSchema = z.object({ text: z.string().trim().min(1).max(2000) }).strict();

function safeMessage(error: unknown): { message: string; status: number } {
  if (error instanceof RequestError) return { message: error.message, status: error.status };
  if (error instanceof DomainError) return { message: error.message, status: 409 };
  return {
    message: 'No se pudo completar la operación. Revisá la conexión y volvé a intentar.',
    status: 502,
  };
}

export async function POST(request: Request) {
  try {
    guardLocal(request, true);
    const parsed = inputSchema.safeParse(await boundedJson(request));
    if (!parsed.success) throw new RequestError('Escribí un mensaje de hasta 2000 caracteres.');
    const id = await sessionId();
    const text = parsed.data.text;
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
        // Client disconnect: runSecretary observes request.signal via `combined`.
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
    const { message, status } = safeMessage(error);
    return Response.json({ error: message }, { status });
  }
}
