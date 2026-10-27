import { DICTATION_MAX_SECONDS, DICTATION_SAMPLE_RATE, encodePcmWav } from '../domain/pcm';

type Callbacks = {
  onProgress: (seconds: number, level: number) => void;
  onLimit: () => void;
  onInterrupted: () => void;
};
export function microphoneError(error: unknown) {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return 'No se pudo acceder al micrófono. Revisá el permiso de este sitio en el navegador.';
  if (name === 'NotFoundError') return 'No encontramos un micrófono. Conectalo y volvé a intentar.';
  if (name === 'NotReadableError')
    return 'El micrófono está ocupado o no está disponible. Revisá otras aplicaciones.';
  return error instanceof Error ? error.message : 'No se pudo grabar el audio. Volvé a intentar.';
}

/** One capture per instance. Owns tracks, context, timers and in-memory samples. */
export class MicrophoneCapture {
  private stream?: MediaStream;
  private context?: AudioContext;
  private source?: MediaStreamAudioSourceNode;
  private node?: AudioWorkletNode;
  private chunks: Float32Array<ArrayBuffer>[] = [];
  private frames = 0;
  private closed = false;
  private stopping = false;
  private limitReached = false;
  private deadline?: ReturnType<typeof setTimeout>;
  private finish?: () => void;
  private rejectFinish?: (error: Error) => void;

  constructor(private callbacks: Callbacks) {}

  async start() {
    if (
      !globalThis.isSecureContext ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof AudioContext === 'undefined' ||
      typeof AudioWorkletNode === 'undefined'
    )
      throw new Error(
        'Este navegador no permite grabar aquí. Usá un navegador actualizado en localhost o HTTPS.',
      );
    try {
      // Create/resume from the click, before awaiting the permission dialog.
      try {
        this.context = new AudioContext({ sampleRate: DICTATION_SAMPLE_RATE });
      } catch {
        this.context = new AudioContext();
      }
      const resumed = this.context.resume();
      // Handle both promises immediately, including a late permission result after cancellation.
      const media = navigator.mediaDevices
        .getUserMedia({
          audio: {
            channelCount: { ideal: 1 },
            echoCancellation: true,
            noiseSuppression: true,
          },
          video: false,
        })
        .then((stream) => {
          if (this.closed) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }
          this.stream = stream;
        });
      await Promise.all([resumed, media]);
      if (this.closed) return;
      const context = this.context;
      const stream = this.stream;
      if (!stream || !context.audioWorklet)
        throw new Error('No se pudo preparar la captura de audio.');
      await context.audioWorklet.addModule('/audio/pcm-capture.js');
      if (this.closed) return;
      if (context.state !== 'running')
        throw new Error('El audio se interrumpió antes de empezar. Volvé a intentar.');
      this.source = context.createMediaStreamSource(stream);
      this.node = new AudioWorkletNode(context, 'denta-pcm-capture', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        channelCount: 1,
        channelCountMode: 'explicit',
      });
      this.node.port.onmessage = ({ data }) => {
        if (this.closed) return;
        if (data.type === 'finished') {
          this.finish?.();
          return;
        }
        if (data.type === 'limit' && !this.limitReached && !this.stopping) {
          this.limitReached = true;
          this.callbacks.onLimit();
          return;
        }
        if (data.type !== 'samples' || !(data.samples instanceof Float32Array)) return;
        const room = Math.max(
          0,
          Math.floor(context.sampleRate * DICTATION_MAX_SECONDS) - this.frames,
        );
        const samples = new Float32Array(data.samples.subarray(0, room));
        if (samples.length) {
          this.chunks.push(samples);
          this.frames += samples.length;
          const rms = Math.sqrt(
            samples.reduce((sum, value) => sum + value * value, 0) / samples.length,
          );
          this.callbacks.onProgress(
            Math.floor(this.frames / context.sampleRate),
            Math.min(1, rms * 5),
          );
        }
        if (!this.limitReached && this.frames >= context.sampleRate * DICTATION_MAX_SECONDS) {
          this.limitReached = true;
          this.callbacks.onLimit();
        }
      };
      const interrupted = () => {
        if (!this.closed && !this.stopping) {
          this.cancel();
          this.callbacks.onInterrupted();
        }
      };
      stream.getAudioTracks().forEach((track) => {
        track.onended = interrupted;
      });
      context.onstatechange = () => {
        if (context.state !== 'running') interrupted();
      };
      this.node.onprocessorerror = interrupted;
      this.source.connect(this.node);
      this.node.connect(context.destination); // Processor output is silence, not microphone playback.
      this.deadline = setTimeout(() => {
        if (!this.closed && !this.stopping) this.callbacks.onLimit();
      }, DICTATION_MAX_SECONDS * 1000);
    } catch (error) {
      this.cancel();
      throw error;
    }
  }

  async stop(): Promise<Blob> {
    if (this.closed || this.stopping || !this.node || !this.context)
      throw new Error('La grabación ya no está disponible. Volvé a intentar.');
    this.stopping = true;
    clearTimeout(this.deadline);
    const sampleRate = this.context.sampleRate;
    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error('No se pudo finalizar el audio. Volvé a grabar.')),
          2000,
        );
        this.finish = () => {
          clearTimeout(timeout);
          resolve();
        };
        this.rejectFinish = (error) => {
          clearTimeout(timeout);
          reject(error);
        };
        this.node?.port.postMessage('finish');
      });
      const samples = new Float32Array(this.frames);
      let offset = 0;
      for (const chunk of this.chunks) {
        samples.set(chunk, offset);
        offset += chunk.length;
      }
      this.cancel(); // Release the microphone BEFORE conversion or upload.
      let pcm = samples;
      if (sampleRate !== DICTATION_SAMPLE_RATE && samples.length) {
        const offline = new OfflineAudioContext(
          1,
          Math.round((samples.length * DICTATION_SAMPLE_RATE) / sampleRate),
          DICTATION_SAMPLE_RATE,
        );
        const input = offline.createBuffer(1, samples.length, sampleRate);
        input.copyToChannel(samples, 0);
        const source = offline.createBufferSource();
        source.buffer = input;
        source.connect(offline.destination);
        source.start();
        pcm = new Float32Array((await offline.startRendering()).getChannelData(0));
      }
      return new Blob([encodePcmWav(pcm)], { type: 'audio/wav' });
    } finally {
      this.cancel();
    }
  }

  cancel() {
    this.closed = true;
    clearTimeout(this.deadline);
    this.rejectFinish?.(new Error('Grabación descartada.'));
    this.finish = undefined;
    this.rejectFinish = undefined;
    this.source?.disconnect();
    this.node?.disconnect();
    if (this.node) {
      this.node.port.onmessage = null;
      this.node.port.close();
    }
    this.stream?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    if (this.context) {
      this.context.onstatechange = null;
      void this.context.close().catch(() => {});
    }
    this.stream = undefined;
    this.context = undefined;
    this.source = undefined;
    this.node = undefined;
    this.chunks = [];
  }
}
