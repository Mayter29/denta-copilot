import { wavDuration } from '@/lib/domain/wav';
import { apiError, guardLocal, RequestError, sessionId } from '@/lib/server/workspace';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    guardLocal(request, true);
    await sessionId();
    const apiKey = process.env.META_API_KEY || process.env.MODEL_API_KEY;
    if (!apiKey) throw new RequestError('Set META_API_KEY before transcribing.', 503);
    const reader = request.body?.getReader();
    if (!reader) throw new RequestError('Attach a WAV recording.');
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 2_000_000) {
        await reader.cancel();
        throw new RequestError('Audio is larger than the 2 MB limit.', 413);
      }
      chunks.push(part.value);
    }
    const wav = Buffer.concat(chunks);
    try {
      wavDuration(wav);
    } catch (e) {
      throw new RequestError((e as Error).message);
    }
    const form = new FormData();
    form.append(
      'request',
      new Blob(
        [
          JSON.stringify({
            model: 'muse-voice-transcribe-1.0',
            audioEncoding: 'WAV',
            mode: 'PUSH_TO_TALK',
          }),
        ],
        { type: 'application/json' },
      ),
    );
    form.append('audio', new Blob([wav], { type: 'audio/wav' }), 'demo.wav');
    const response = await fetch('https://api.meta.ai/v1/asr/transcribe', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'text/plain' },
      body: form,
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(45_000)]),
    });
    if (!response.ok)
      throw new RequestError(
        'Meta could not transcribe the audio. Check the format and try again.',
        502,
      );
    const text = (await response.text()).trim().slice(0, 2000);
    if (!text) throw new RequestError('No speech was detected in the audio.');
    // Audio stays in memory for this request; never persisted or written to logs.
    return Response.json({ text });
  } catch (error) {
    return apiError(error);
  }
}
