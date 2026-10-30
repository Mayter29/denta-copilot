import { describe, expect, it, vi } from 'vitest';
import {
  readAgentContext,
  readDayAgenda,
  readRunDelta,
  selectHistory,
  type ReaderClient,
} from './connected-view';

const T = '10000000-0000-4000-8000-000000000001';
const B = '20000000-0000-4000-8000-000000000001';
const C = '40000000-0000-4000-8000-000000000001';
const RUN = '70000000-0000-4000-8000-000000000001';
const P = '30000000-0000-4000-8000-000000000001';
const S = '40000000-0000-4000-8000-000000000002';
const SRC = '50000000-0000-4000-8000-000000000001';

type Call = { table: string; op: string; args: unknown[] };
function fakeReader(rows: Record<string, unknown[]>) {
  const calls: Call[] = [];
  const client: ReaderClient = {
    from(table: string) {
      return {
        select(columns: string) {
          calls.push({ table, op: 'select', args: [columns] });
          const chain: Record<string, unknown> = {};
          for (const op of ['eq', 'neq', 'order', 'limit', 'range', 'gte', 'lt', 'lte', 'in'] as const) {
            chain[op] = (...args: unknown[]) => {
              calls.push({ table, op, args });
              return chain;
            };
          }
          chain.then = (resolve: (value: unknown) => unknown) =>
            Promise.resolve({ data: rows[table] ?? [], error: null }).then(resolve);
          return chain as never;
        },
      };
    },
  };
  return { client, calls };
}
const has = (calls: Call[], table: string, op: string, ...args: unknown[]) =>
  calls.some((c) => c.table === table && c.op === op && JSON.stringify(c.args) === JSON.stringify(args));

describe('historial del agente', () => {
  it('ordena cronológico, limita a 18 y excluye el run actual sin duplicar', () => {
    const rows = Array.from({ length: 25 }, (_, i) => ({
      run_id: i === 0 ? RUN : `run-${i}`,
      role: (i % 2 ? 'assistant' : 'user') as 'user' | 'assistant',
      content: `m${24 - i}`,
    }));
    const history = selectHistory(rows, RUN);
    expect(history).toHaveLength(18);
    expect(history[0].content).toBe('m6');
    expect(history.at(-1)?.content).toBe('m23');
    // El mensaje del run actual (primero en desc) no entra: el llamador lo agrega una vez.
    expect(history.some((m) => m.content === 'm24')).toBe(false);
  });
});

describe('lecturas acotadas por consumidor', () => {
  it('el contexto del agente filtra por sede, ventana y límite en SQL', async () => {
    const messages = Array.from({ length: 19 }, (_, i) => ({
      id: `90000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      conversation_id: C, run_id: i === 0 ? RUN : '80000000-0000-4000-8000-000000000001',
      role: i % 2 ? 'assistant' : 'user', content: `m${18 - i}`, result_kind: i % 2 ? 'answer' : null,
    }));
    const { client, calls } = fakeReader({
      dc_demo_professionals: [{ id: P, name: 'Dra. Demo', active: true }],
      dc_demo_services: [{ id: S, name: 'Valoración', duration_minutes: 30, price_minor: 100, active: true }],
      dc_demo_offerings: [{ professional_id: P, service_id: S, active: true }],
      dc_demo_business_hours: [{ weekday: 2, opens_at: '08:00', closes_at: '17:00' }],
      dc_demo_closures: [],
      dc_demo_appointments: [],
      dc_sources: [{ id: SRC, title: 'Horario', content: 'Lun a vie', content_hash: 'a'.repeat(64) }],
      dc_messages: messages,
    });
    const reads = await readAgentContext(client, {
      tenantId: T, branchId: B, conversationId: C, runId: RUN, timeZone: 'America/Costa_Rica', today: '2026-10-27',
    });
    expect(reads.history).toHaveLength(18);
    expect(has(calls, 'dc_messages', 'eq', 'conversation_id', C)).toBe(true);
    expect(has(calls, 'dc_messages', 'order', 'sequence', { ascending: false })).toBe(true);
    expect(has(calls, 'dc_messages', 'limit', 19)).toBe(true);
    expect(has(calls, 'dc_demo_appointments', 'eq', 'branch_id', B)).toBe(true);
    expect(has(calls, 'dc_demo_appointments', 'eq', 'status', 'scheduled')).toBe(true);
    expect(calls.some((c) => c.table === 'dc_demo_appointments' && c.op === 'gte')).toBe(true);
    expect(calls.some((c) => c.table === 'dc_sources' && c.op === 'eq' && c.args[0] === 'branch_id')).toBe(true);
  });

  it('la agenda del día solo pide esa fecha y la delta del run solo ese run', async () => {
    const { client, calls } = fakeReader({
      dc_demo_appointments: [], dc_demo_professionals: [], dc_demo_services: [], dc_demo_business_hours: [],
      dc_messages: [], dc_proposals: [],
    });
    await readDayAgenda(client, { tenantId: T, branchId: B, date: '2026-10-28', timeZone: 'America/Costa_Rica' });
    expect(has(calls, 'dc_demo_appointments', 'eq', 'status', 'scheduled')).toBe(true);
    expect(calls.some((c) => c.table === 'dc_demo_appointments' && c.op === 'gte')).toBe(true);
    expect(calls.some((c) => c.table === 'dc_demo_appointments' && c.op === 'lt')).toBe(true);

    const deltaReader = fakeReader({ dc_messages: [], dc_proposals: [] });
    const delta = await readRunDelta(deltaReader.client, {
      tenantId: T, branchId: B, conversationId: C, runId: RUN, timeZone: 'America/Costa_Rica', terminal: 'published',
    });
    expect(delta.messages).toEqual([]);
    expect(has(deltaReader.calls, 'dc_messages', 'eq', 'run_id', RUN)).toBe(true);
    expect(has(deltaReader.calls, 'dc_proposals', 'eq', 'run_id', RUN)).toBe(true);
    // Sin propuestas ni mensajes no hay consultas de comprobantes ni fuentes.
    expect(deltaReader.calls.some((c) => c.table === 'dc_receipts')).toBe(false);
    expect(vi).toBeTruthy();
  });
});
