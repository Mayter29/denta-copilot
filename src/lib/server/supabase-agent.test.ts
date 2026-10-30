import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { connectedAvailability, runSecretaryConnected, type ConnectedReads } from './supabase-agent';
import { scriptedModel, toolOutput } from './conversation-harness';

const TZ = 'America/Costa_Rica';
const now = new Date('2026-10-27T07:00:00-06:00');
const PRO = '33333333-0000-4000-8000-000000000001';
const SER = '44444444-0000-4000-8000-000000000001';
const APT = '55555555-0000-4000-8000-000000000001';

function reads(): ConnectedReads {
  return {
    catalog: {
      professionals: [{ id: PRO, name: 'Dra. Demo' }],
      services: [{ id: SER, name: 'Valoración demo', duration: 30, price: 15000 }],
      offerings: [{ professionalId: PRO, serviceId: SER }],
      hours: [{ weekday: 2, opens: '08:00', closes: '17:00' }],
      closures: [],
    },
    appointments: [],
    sources: [{ id: '99999999-0000-4000-8000-000000000001', title: 'Horario demo', content: 'Lunes a viernes de 08:00 a 17:00.', version: 'v1' }],
    history: [],
  };
}
const store = () => ({
  proposeDemoAppointment: vi.fn(async () => '66666666-0000-4000-8000-000000000001'),
  recordToolEvent: vi.fn(async () => {}),
  recordSource: vi.fn(async () => {}),
  publishRun: vi.fn(async () => ({ kind: 'proposal', text: 'Propuesta pendiente.', execution: 'none', proposal_ids: [], source_ids: [] })),
  abortRun: vi.fn(async () => {}),
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('agente conectado a Supabase', () => {
  it('calcula disponibilidad real desde horarios y choques', () => {
    const base = reads();
    const free = connectedAvailability(base, { date: '2026-10-27', professionalId: PRO, serviceId: SER }, now, TZ);
    expect(free).toContain('11:00');
    expect(free).not.toContain('07:30');
    const busy = {
      ...base,
      appointments: [
        { id: APT, patient: 'Ana', doctorId: PRO, serviceId: SER, date: '2026-10-27', time: '11:00', duration: 30, status: 'scheduled', version: 1 },
      ],
    } as ConnectedReads;
    expect(connectedAvailability(busy, { date: '2026-10-27', professionalId: PRO, serviceId: SER }, now, TZ)).not.toContain('11:00');
  });
  it('publica la propuesta verificada por el servidor sin escribir local', async () => {
    const fake = store();
    const model = scriptedModel([
      { toolName: 'findAvailability', input: { date: '2026-10-28', professionalId: PRO, serviceId: SER } },
      { toolName: 'proposeBooking', input: { patient: 'Marina Ficticia', professionalId: PRO, serviceId: SER, date: '2026-10-28', time: '11:00' } },
      (prompt) => ({
        toolName: 'submitResult',
        input: { kind: 'proposal', text: 'Ya agendé', sourceIds: [], proposalIds: [toolOutput<{ proposalId: string }>(prompt, 'proposeBooking').proposalId] },
      }),
    ]);
    const result = await runSecretaryConnected({
      model,
      reads: { ...reads(), catalog: { ...reads().catalog, hours: [{ weekday: 3, opens: '08:00', closes: '17:00' }] } },
      store: fake as never,
      actor: '00000000-0000-4000-8000-000000000001',
      runId: '77777777-0000-4000-8000-000000000001',
      timeZone: TZ,
      today: '2026-10-27',
      text: 'Reservá para Marina',
      now,
    });
    expect(result.status).toBe('published');
    expect(fake.proposeDemoAppointment).toHaveBeenCalledTimes(1);
    const calls = fake.proposeDemoAppointment.mock.calls as unknown[][];
    const args = (calls[0]?.[0] ?? {}) as Record<string, unknown>;
    expect(args.operation).toBe('book');
    expect(args.startsAt).toBe('2026-10-28T17:00:00.000Z');
    expect(fake.publishRun).toHaveBeenCalledTimes(1);
  });
  it('aborta y descarta borradores ante referencias no verificadas', async () => {
    const fake = store();
    fake.publishRun.mockRejectedValueOnce(new Error('unverified_references'));
    const model = scriptedModel([
      { toolName: 'submitResult', input: { kind: 'answer', text: 'Listo', sourceIds: ['99999999-0000-4000-8000-000000000001'], proposalIds: [] } },
    ]);
    const result = await runSecretaryConnected({
      model,
      reads: reads(),
      store: fake as never,
      actor: '00000000-0000-4000-8000-000000000001',
      runId: '77777777-0000-4000-8000-000000000001',
      timeZone: TZ,
      today: '2026-10-27',
      text: 'Hola',
      now,
    });
    expect(result.status).toBe('failed');
    expect(fake.abortRun).toHaveBeenCalledTimes(1);
  });
});
