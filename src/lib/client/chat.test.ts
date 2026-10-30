import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendChat } from './chat';

const sse = (events: string) =>
  new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(events));
      controller.close();
    },
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('transporte SSE del chat', () => {
  it('entrega progresos reales y luego el final verificado', async () => {
    const body = [
      'event: progress',
      'data: {"id":"agenda","label":"Consultando agenda"}',
      '',
      'event: progress',
      'data: {"id":"proposal","label":"Preparando propuesta"}',
      '',
      'event: final',
      'data: {"messages":[],"proposals":[],"appointments":[],"audit":[]}',
      '',
    ].join('\n');
    const seen: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(sse(body), { headers: { 'Content-Type': 'text/event-stream' } })),
    );
    const final = await sendChat('Hola', { onProgress: (p) => seen.push(p.id) });
    expect(seen).toEqual(['agenda', 'proposal']);
    expect(final.proposals).toEqual([]);
  });

  it('propaga errores del servidor sin mostrar éxito', async () => {
    const body = 'event: error\ndata: {"error":"Alcanzaste el límite de esta sesión de demo."}\n\n';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(sse(body), { headers: { 'Content-Type': 'text/event-stream' } })),
    );
    await expect(sendChat('Hola')).rejects.toThrow('límite');
  });

  it('cancelar aborta la espera', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: unknown, init?: { signal?: AbortSignal }) => {
        if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        return new Response(sse('event: progress\ndata: {"id":"agenda","label":"Consultando agenda"}\n\n'), {
          headers: { 'Content-Type': 'text/event-stream' },
        });
      }),
    );
    const controller = new AbortController();
    controller.abort();
    await expect(sendChat('Hola', { signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('rechaza un final no verificado', async () => {
    const body = 'event: final\ndata: {"messages":[]}\n\n';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(sse(body), { headers: { 'Content-Type': 'text/event-stream' } })),
    );
    await expect(sendChat('Hola')).rejects.toThrow('verificar');
  });
});
