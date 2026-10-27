import { afterEach, expect, it, vi } from 'vitest';
import { appendTranscript, transcribeWav } from './transcription';
afterEach(() => vi.unstubAllGlobals());
it('añade la transcripción sin reemplazar ni truncar el borrador anterior', () => {
  expect(appendTranscript('Texto previo', 'Dictado')).toBe('Texto previo\nDictado');
  expect(appendTranscript('x'.repeat(1999), 'Dictado')).toBeNull();
});
it('usa solo el endpoint de transcripción y valida el resultado', async () => {
  const fetcher = vi.fn(async () => Response.json({ text: ' Dictado ficticio ' }));
  vi.stubGlobal('fetch', fetcher);
  expect(await transcribeWav(new Blob(['audio']), new AbortController().signal)).toBe(
    'Dictado ficticio',
  );
  expect(fetcher.mock.calls).toHaveLength(1);
  expect(fetcher).toHaveBeenCalledWith(
    '/api/transcribe',
    expect.objectContaining({ method: 'POST' }),
  );
});
it.each([
  new Response('not json', { status: 502 }),
  Response.json({ text: '' }),
  Response.json({ text: 12 }),
])('maneja respuestas inesperadas sin entregar texto de éxito', async (response) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => response.clone()),
  );
  await expect(transcribeWav(new Blob(), new AbortController().signal)).rejects.toThrow();
});
