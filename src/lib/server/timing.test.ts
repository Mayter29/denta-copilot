import { describe, expect, it, vi } from 'vitest';
import { createTurnTimer, logTurn } from './timing';

describe('medición de latencia del turno', () => {
  it('acumula fases, llamadas y tokens con reloj monotónico', async () => {
    const timer = createTurnTimer();
    timer.checkpoint('session');
    timer.recordModel(120, { inputTokens: 50, outputTokens: 10 }, 2);
    timer.recordTool('findAvailability', 30);
    timer.checkpoint('publish');
    const summary = timer.summary();
    expect(summary.modelCalls).toBe(1);
    expect(summary.steps).toBe(2);
    expect(summary.inputTokens).toBe(50);
    expect(summary.outputTokens).toBe(10);
    expect(summary.totalMs).toBeGreaterThanOrEqual(0);
    expect(Object.keys(summary.phases).sort()).toEqual(['model', 'publish', 'session', 'tool:findAvailability']);
  });
  it('ignora usos con formas desconocidas sin romper el resumen', () => {
    const timer = createTurnTimer();
    timer.recordModel(10, { inputTokens: 'muchos' });
    timer.recordModel(5);
    expect(timer.summary().modelCalls).toBe(2);
    expect(timer.summary().inputTokens).toBeUndefined();
  });
  it('el registro expone solo números e identificadores, nunca contenido', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    logTurn('chat-turn', { requestId: 'r1', runId: 'r2', mode: 'local', totalMs: 12 });
    expect(info).toHaveBeenCalledTimes(1);
    const logged = String(info.mock.calls[0]?.[0] ?? '');
    expect(logged).toBe('{"scope":"chat-turn","requestId":"r1","runId":"r2","mode":"local","totalMs":12}');
    info.mockRestore();
  });
});
