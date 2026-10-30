/**
 * Monotonic per-request timing for the chat turn critical path.
 * Records durations (ms), step counts and token usage only.
 * Never records prompts, conversations, passwords, cookies, tokens or personal labels.
 */
import type { TurnTiming } from '../domain/chat-delta';

export type TurnTimer = {
  checkpoint: (phase: string) => void;
  recordModel: (ms: number, usage?: unknown, steps?: number) => void;
  recordTool: (name: string, ms: number) => void;
  summary: () => TurnTiming;
};

function toFinite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function createTurnTimer(): TurnTimer {
  const start = performance.now();
  let last = start;
  const phases: Record<string, number> = {};
  let steps = 0;
  let modelCalls = 0;
  let inputTokens: number | undefined;
  let outputTokens: number | undefined;
  return {
    checkpoint(phase: string) {
      const now = performance.now();
      phases[phase] = (phases[phase] ?? 0) + Math.max(0, now - last);
      last = now;
    },
    recordModel(ms: number, usage?: unknown, stepCount?: number) {
      modelCalls += 1;
      phases.model = (phases.model ?? 0) + Math.max(0, ms);
      if (typeof stepCount === 'number' && Number.isFinite(stepCount)) steps += stepCount;
      if (usage && typeof usage === 'object') {
        const record = usage as Record<string, unknown>;
        const input = toFinite(record.inputTokens);
        const output = toFinite(record.outputTokens);
        if (input !== undefined) inputTokens = (inputTokens ?? 0) + input;
        if (output !== undefined) outputTokens = (outputTokens ?? 0) + output;
      }
    },
    recordTool(name: string, ms: number) {
      const key = `tool:${name}`;
      phases[key] = (phases[key] ?? 0) + Math.max(0, ms);
    },
    summary() {
      const summary: TurnTiming = {
        totalMs: Math.max(0, performance.now() - start),
        steps,
        modelCalls,
        phases: { ...phases },
      };
      if (inputTokens !== undefined) summary.inputTokens = inputTokens;
      if (outputTokens !== undefined) summary.outputTokens = outputTokens;
      return summary;
    },
  };
}

/** One-line server log for latency comparison. Numbers and ids only, no content. */
export function logTurn(scope: string, fields: Record<string, string | number | undefined>) {
  console.info(JSON.stringify({ scope, ...fields }));
}
