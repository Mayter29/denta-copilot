// Own processor. Never forwards microphone samples to the speakers.
class DentaPcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.samples = new Float32Array(2048);
    this.offset = 0;
    this.finished = false;
    this.accepting = true;
    this.frames = 0;
    this.port.onmessage = ({ data }) => {
      if (data === 'finish' && !this.finished) {
        this.finished = true;
        this.flush();
        this.port.postMessage({ type: 'finished' });
      }
    };
  }
  flush() {
    if (!this.offset) return;
    const chunk = this.samples.slice(0, this.offset);
    this.port.postMessage({ type: 'samples', samples: chunk }, [chunk.buffer]);
    this.offset = 0;
  }
  process(inputs, outputs) {
    for (const channel of outputs[0] ?? []) channel.fill(0);
    const input = inputs[0]?.[0];
    if (!input || this.finished || !this.accepting) return !this.finished;
    for (const sample of input) {
      this.samples[this.offset++] = sample;
      this.frames++;
      if (this.offset === this.samples.length) this.flush();
      if (this.frames >= sampleRate * 60) {
        this.accepting = false;
        this.flush();
        this.port.postMessage({ type: 'limit' });
        break;
      }
    }
    return true;
  }
}
registerProcessor('denta-pcm-capture', DentaPcmCapture);
