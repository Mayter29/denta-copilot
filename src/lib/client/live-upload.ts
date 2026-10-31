/** ~250 ms of PCM16 mono 16 kHz per POST: low latency without flooding HTTP/1.1. */
export const LIVE_CHUNK_BYTES = 8_000;
/** Cap on audio held while the bridge is unreachable (about 10 s). */
const MAX_PENDING_BYTES = 320_000;

type Send = (url: string, body?: Uint8Array) => Promise<Response>;

const defaultSend: Send = (url, body) =>
  fetch(url, {
    method: 'POST',
    body: body as BodyInit | undefined,
    headers: body ? { 'Content-Type': 'application/octet-stream' } : undefined,
  });

/**
 * Sends live PCM to the server bridge as short, ordered POSTs (works on HTTP/1.1,
 * where Chrome rejects streaming uploads). Audio pushed before the stream ID is
 * known is held and sent once `attach` runs. One request in flight at a time.
 */
export class LiveUploader {
  private id = '';
  private pending: Uint8Array[] = [];
  private pendingBytes = 0;
  private flushing: Promise<void> | null = null;
  private closed = false;
  private failed = false;

  constructor(
    private readonly onError: (message: string) => void,
    private readonly send: Send = defaultSend,
    private readonly endpoint = '/api/voice-stream',
  ) {}

  attach(id: string) {
    if (this.id || this.failed) return;
    this.id = id;
    // Stopped while connecting: send everything held and drain right away.
    if (this.closed) void this.finish();
    else void this.flush(false);
  }

  push(bytes: Uint8Array) {
    if (this.closed || this.failed) return;
    if (this.pendingBytes + bytes.byteLength > MAX_PENDING_BYTES) {
      this.fail('La conexión de voz se quedó atrás. Volvé a intentar.');
      return;
    }
    this.pending.push(bytes);
    this.pendingBytes += bytes.byteLength;
    if (this.id && this.pendingBytes >= LIVE_CHUNK_BYTES) void this.flush(false);
  }

  /** Sends what is left, then asks the bridge to drain. Turns keep arriving over SSE. */
  async close() {
    if (this.closed) return;
    this.closed = true;
    if (this.id) await this.finish();
  }

  private async finish() {
    if (this.failed) return;
    await this.flush(true);
    if (this.failed) return;
    await this.post('end').catch(() => {});
  }

  /** Stop without sending anything else (cancel or teardown). */
  abandon() {
    this.closed = true;
    this.failed = true;
    this.pending = [];
    this.pendingBytes = 0;
  }

  private async flush(all: boolean): Promise<void> {
    // Serialize: chain after the current request so chunks keep their order.
    const previous = this.flushing ?? Promise.resolve();
    const run = previous.then(async () => {
      while (!this.failed && this.pendingBytes && (all || this.pendingBytes >= LIVE_CHUNK_BYTES)) {
        const chunk = this.take(all ? this.pendingBytes : LIVE_CHUNK_BYTES);
        if (!chunk.byteLength) break;
        try {
          const response = await this.post('audio', chunk);
          if (!response.ok) {
            const body: unknown = await response.json().catch(() => null);
            const message =
              body && typeof body === 'object' && 'error' in body ? String((body as { error: unknown }).error) : '';
            this.fail(message || 'No se pudo enviar el audio en vivo.');
          }
        } catch {
          this.fail('Se cortó la conexión de voz en vivo.');
        }
      }
    });
    this.flushing = run;
    await run;
    if (this.flushing === run) this.flushing = null;
  }

  /** Takes whole PCM16 samples (even byte counts) from the front of the queue. */
  private take(limit: number) {
    const size = Math.min(this.pendingBytes, limit) & ~1;
    const out = new Uint8Array(size);
    let offset = 0;
    while (offset < size) {
      const head = this.pending[0];
      const part = Math.min(head.byteLength, size - offset);
      out.set(head.subarray(0, part), offset);
      offset += part;
      if (part === head.byteLength) this.pending.shift();
      else this.pending[0] = head.subarray(part);
    }
    this.pendingBytes -= size;
    return out;
  }

  private post(op: 'audio' | 'end', body?: Uint8Array) {
    return this.send(`${this.endpoint}?op=${op}&id=${encodeURIComponent(this.id)}`, body);
  }

  private fail(message: string) {
    if (this.failed) return;
    this.abandon();
    this.onError(message);
  }
}
