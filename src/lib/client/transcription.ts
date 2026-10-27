import { z } from 'zod';

const transcriptSchema = z.object({ text: z.string().trim().min(1).max(2000) });
export function appendTranscript(draft: string, text: string) {
  const merged = [draft.trimEnd(), text.trim()].filter(Boolean).join('\n');
  return merged.length <= 2000 ? merged : null;
}
export async function transcribeWav(audio: Blob, signal: AbortSignal) {
  const response = await fetch('/api/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'audio/wav' },
    body: audio,
    signal,
  });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const parsed = z.object({ error: z.string().max(400) }).safeParse(body);
    throw new Error(
      parsed.success ? parsed.data.error : 'No se pudo transcribir. Volvé a intentar.',
    );
  }
  const parsed = transcriptSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success)
    throw new Error('La transcripción llegó vacía o no se pudo leer. Volvé a intentar.');
  return parsed.data.text;
}
