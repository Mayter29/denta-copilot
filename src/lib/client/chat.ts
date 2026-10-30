import { z } from 'zod';
import type { ChatProgress } from '@/lib/domain/chat-progress';
import type { ChatDelta } from '@/lib/domain/chat-delta';

const progressSchema = z.object({ id: z.string().min(1), label: z.string().min(1).max(120) });
const contextSchema = z.object({
  tenantId: z.uuid(),
  branchId: z.uuid(),
  conversationId: z.uuid().nullable().optional(),
  requestId: z.uuid(),
});
export type ChatContext = z.infer<typeof contextSchema>;

const timingSchema = z.object({
  totalMs: z.number(),
  steps: z.number(),
  modelCalls: z.number(),
  inputTokens: z.number().optional(),
  outputTokens: z.number().optional(),
  phases: z.record(z.string(), z.number()),
});
const finalSchema = z.object({
  messages: z.array(z.unknown()),
  proposals: z.array(z.unknown()),
  appointments: z.array(z.unknown()),
  audit: z.array(z.unknown()),
  conversationId: z.uuid().nullable().optional(),
  terminal: z.enum(['published', 'paused', 'failed', 'cancelled']).optional(),
  timing: timingSchema.optional(),
});
const errorSchema = z.object({ error: z.string().min(1).max(400) });

export type ChatFinalPayload = ChatDelta;

type ChatEvents = {
  onProgress?: (progress: ChatProgress) => void;
  signal?: AbortSignal;
  context?: ChatContext;
};

/** POST /api/chat as SSE: progress events then a single verified final (or error). */
export async function sendChat(text: string, events: ChatEvents = {}): Promise<ChatFinalPayload> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(events.context ? { text, ...contextSchema.parse(events.context) } : { text }),
    signal: events.signal,
  });
  const contentType = response.headers.get('content-type') ?? '';
  if (!response.ok || !contentType.includes('text/event-stream')) {
    const body: unknown = await response.json().catch(() => null);
    const parsed = errorSchema.safeParse(body);
    throw new Error(parsed.success ? parsed.data.error : 'No se pudo completar la solicitud.');
  }
  if (!response.ok || !response.body) throw new Error('No se pudo leer la respuesta del servidor.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const onProgress = events.onProgress;

  const handleEvent = (name: string, raw: string): ChatFinalPayload | null => {
    if (name === 'progress') {
      const parsed = progressSchema.safeParse(JSON.parse(raw));
      if (parsed.success && onProgress) {
        onProgress(parsed.data as ChatProgress);
      }
      return null;
    }
    if (name === 'final') {
      const parsed = finalSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) throw new Error('La respuesta final no se pudo verificar.');
      return parsed.data as unknown as ChatFinalPayload;
    }
    if (name === 'error') {
      const parsed = errorSchema.safeParse(JSON.parse(raw));
      throw new Error(
        parsed.success ? parsed.data.error : 'No se pudo completar la solicitud.',
      );
    }
    return null;
  };

  const parseChunk = (chunk: string): ChatFinalPayload | null => {
    let name = '';
    let data = '';
    for (const line of chunk.split('\n')) {
      if (line.startsWith('event:')) name = line.slice(6).trim();
      else if (line.startsWith('data:')) data += line.slice(5).trim();
    }
    if (name && data) return handleEvent(name, data);
    return null;
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf('\n\n');
      while (boundary >= 0) {
        const chunk = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const final = parseChunk(chunk);
        if (final) {
          await reader.cancel().catch(() => {});
          return final;
        }
        boundary = buffer.indexOf('\n\n');
      }
    }
    if (buffer.trim()) {
      const final = parseChunk(buffer);
      if (final) return final;
    }
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw error instanceof Error
      ? error
      : new Error('No se pudo completar la solicitud.');
  } finally {
    reader.releaseLock();
  }
  throw new Error('La respuesta se interrumpió antes de verificarse.');
}
