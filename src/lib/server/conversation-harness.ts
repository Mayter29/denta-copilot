// Offline only: this module must never be imported by product routes.
import { MockLanguageModelV4 } from 'ai/test';

export type ScriptCall = { toolName: string; input: unknown };
export type ScriptStep = ScriptCall | { text: string } | ((prompt: unknown) => ScriptCall);
export function toolOutput<T>(prompt: unknown, name: string): T {
  const messages = prompt as {
    content: { type: string; toolName?: string; output?: { value?: unknown } }[];
  }[];
  const outputs = messages
    .flatMap((m) => (Array.isArray(m.content) ? m.content : []))
    .filter((part) => part.type === 'tool-result' && part.toolName === name);
  if (!outputs.length) throw new Error(`No tool output for ${name}`);
  return outputs.at(-1)!.output!.value as T;
}
export function scriptedModel(
  steps: ScriptStep[],
  finalReason?: 'length' | 'error' | 'content-filter',
) {
  let index = 0;
  return new MockLanguageModelV4({
    doGenerate: async ({ prompt }) => {
      if (index >= steps.length) throw new Error('Unexpected provider call');
      const script = steps[index++];
      const step = typeof script === 'function' ? script(prompt) : script;
      return {
        content:
          'text' in step
            ? [{ type: 'text' as const, text: step.text }]
            : [
                {
                  type: 'tool-call' as const,
                  toolCallId: `call-${index}`,
                  toolName: step.toolName,
                  input: JSON.stringify(step.input),
                },
              ],
        finishReason: {
          unified:
            index === steps.length && finalReason
              ? finalReason
              : 'text' in step
                ? ('stop' as const)
                : ('tool-calls' as const),
          raw: undefined,
        },
        usage: {
          inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 5, text: 5, reasoning: undefined },
        },
        warnings: [],
      };
    },
  });
}
