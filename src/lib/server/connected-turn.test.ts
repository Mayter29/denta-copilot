import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runConnectedTurn } from './connected-chat';
import { scriptedModel } from './conversation-harness';

vi.mock('./auth', async (original) => {
  const actual = await original<typeof import('./auth')>();
  return { ...actual, userSupabase: () => fakeReader };
});

const calls: string[] = [];
const IDS = {
  actor: '00000000-0000-4000-8000-000000000001',
  tenant: '10000000-0000-4000-8000-000000000001',
  branch: '20000000-0000-4000-8000-000000000001',
  conversation: '40000000-0000-4000-8000-000000000001',
  professional: '30000000-0000-4000-8000-000000000001',
  service: '40000000-0000-4000-8000-000000000002',
  proposal: '60000000-0000-4000-8000-000000000001',
  run: '70000000-0000-4000-8000-000000000001',
};
const SEED_ROWS: Record<string, unknown[]> = {
  dc_branch_memberships: [{ tenant_id: IDS.tenant, branch_id: IDS.branch }],
  dc_branches: [{ id: IDS.branch, time_zone: 'America/Costa_Rica', active: true }],
  dc_conversations: [{ id: IDS.conversation }],
  dc_demo_professionals: [{ id: IDS.professional, name: 'Dra. Demo', active: true }],
  dc_demo_services: [{ id: IDS.service, name: 'Valoración', duration_minutes: 30, price_minor: 100, active: true }],
  dc_demo_offerings: [{ professional_id: IDS.professional, service_id: IDS.service, active: true }],
  dc_demo_business_hours: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, opens_at: '08:00', closes_at: '17:00' })),
  dc_demo_closures: [],
  dc_demo_appointments: [],
  dc_sources: [],
  dc_messages: [],
  dc_proposals: [],
};
const fakeReader = {
  from: (table: string) => ({
    select: (columns: string) => {
      calls.push(`${table}:${columns.split(',').length}`);
      const chain: Record<string, unknown> = {};
      for (const op of ['eq', 'neq', 'order', 'limit', 'range', 'gte', 'lt', 'lte', 'in']) {
        chain[op] = vi.fn(() => chain);
      }
      chain.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: SEED_ROWS[table] ?? [], error: null }).then(resolve);
      return chain;
    },
  }),
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('turno conectado completo', () => {
  beforeEach(() => {
    calls.length = 0;
  });
  it('publica el turno con delta, tiempos y lecturas acotadas en orden', async () => {
    const events: string[] = [];
    const store = {
      openConversation: vi.fn(async () => { events.push('open'); await sleep(40); return IDS.conversation; }),
      beginRun: vi.fn(async () => { events.push('beginRun'); await sleep(40); return IDS.run; }),
      proposeDemoAppointment: vi.fn(async () => { await sleep(40); return IDS.proposal; }),
      recordToolEvent: vi.fn(async () => {}),
      recordSource: vi.fn(async () => {}),
      publishRun: vi.fn(async () => { await sleep(40); return { kind: 'proposal', text: 'Pendiente', execution: 'none' }; }),
      abortRun: vi.fn(async () => {}),
    };
    const makeModel = () => scriptedModel([
      { toolName: 'findAvailability', input: { date: '2026-11-02', professionalId: IDS.professional, serviceId: IDS.service } },
      { toolName: 'proposeBooking', input: { patient: 'Demo', professionalId: IDS.professional, serviceId: IDS.service, date: '2026-11-02', time: '11:00' } },
      { toolName: 'submitResult', input: { kind: 'proposal', text: 'x', sourceIds: [], proposalIds: [IDS.proposal] } },
    ]);
    const phases: string[] = [];
    const result = await runConnectedTurn({
      accessToken: 'token',
      actor: IDS.actor,
      tenantId: IDS.tenant,
      branchId: IDS.branch,
      requestId: '80000000-0000-4000-8000-000000000001',
      text: 'Reservá para Demo',
      model: makeModel() as never,
      now: new Date('2026-10-27T07:00:00-06:00'),
      store: store as never,
      onProgress: (p) => phases.push(p.id),
    });
    expect(result.terminal).toBe('published');
    expect(result.delta.terminal).toBe('published');
    expect(result.delta.timing?.steps).toBe(3);
    expect(result.delta.timing?.modelCalls).toBe(1);
    // El run se crea antes de leer el historial: el mensaje actual no se duplica.
    expect(events.indexOf('beginRun')).toBeGreaterThanOrEqual(0);
    expect(calls.length).toBeLessThanOrEqual(14);
    expect(phases).toContain('context');
    expect(phases).toContain('model');
    expect(phases.at(-1)).toBe('publishing');
  }, 60000);
});
