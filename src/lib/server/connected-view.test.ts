import { describe, expect, it } from 'vitest';
import {
  buildConnectedView,
  mapAppointment,
  mapProposal,
  toBranchLocal,
  zonedTimeToUtc,
  type ConnectedReads,
} from './connected-view';

const TZ = 'America/Costa_Rica';
const A = '11111111-0000-4000-8000-000000000001';
const B = '22222222-0000-4000-8000-000000000001';
const P = '33333333-0000-4000-8000-000000000001';
const S = '44444444-0000-4000-8000-000000000001';
const PROP = '55555555-0000-4000-8000-000000000001';
const CONV = '66666666-0000-4000-8000-000000000001';
const RUN = '77777777-0000-4000-8000-000000000001';
const RUN0 = '77777777-0000-4000-8000-000000000000';
const M1 = '88888888-0000-4000-8000-000000000001';
const M2 = '88888888-0000-4000-8000-000000000002';
const SRC = '99999999-0000-4000-8000-000000000001';
const appointment = {
  id: A,
  branch_id: B,
  professional_id: P,
  service_id: S,
  patient_label: 'Ana Ficticia',
  starts_at: '2026-11-02T15:00:00.000Z',
  duration_minutes: 60,
  status: 'scheduled' as const,
  version: 1,
};

describe('vista conectada', () => {
  it('convierte instantes UTC a día y hora de la sede', () => {
    expect(toBranchLocal('2026-11-02T15:00:00.000Z', TZ)).toEqual({ date: '2026-11-02', time: '09:00' });
    expect(() => toBranchLocal('no-fecha', TZ)).toThrow();
  });
  it('convierte hora local de la sede a UTC en zona fija y con DST', () => {
    expect(zonedTimeToUtc('2026-11-02', '09:00', TZ)).toBe('2026-11-02T15:00:00.000Z');
    // Nueva York en noviembre (EST, UTC-5) y en julio (EDT, UTC-4).
    expect(zonedTimeToUtc('2026-11-02', '09:00', 'America/New_York')).toBe('2026-11-02T14:00:00.000Z');
    expect(zonedTimeToUtc('2026-07-02', '09:00', 'America/New_York')).toBe('2026-07-02T13:00:00.000Z');
    expect(() => zonedTimeToUtc('2026-13-40', '09:00', TZ)).toThrow();
  });
  it('mapea citas y propuestas con comprobante del servidor', () => {
    expect(mapAppointment(appointment, TZ)).toMatchObject({
      id: A,
      patient: 'Ana Ficticia',
      date: '2026-11-02',
      time: '09:00',
      version: 1,
    });
    const proposal = mapProposal(
      {
        id: PROP,
        branch_id: B,
        conversation_id: CONV,
        run_id: RUN,
        operation: 'book',
        command: { patient_label: 'Ana Ficticia', professional_id: P, service_id: S, starts_at: '2026-11-02T15:00:00.000Z' },
        status: 'confirmed',
        created_at: '2026-11-01T12:00:00.000Z',
      },
      { proposal_id: PROP, effect_reference: A, resource_snapshot: appointment, completed_at: '2026-11-01T12:05:00.000Z' },
      TZ,
    );
    expect(proposal.status).toBe('confirmed');
    expect(proposal.change).toMatchObject({ action: 'book', date: '2026-11-02', time: '09:00' });
    expect(proposal.receipt?.appointment.id).toBe(A);
    expect(proposal.resultId).toBe(A);
  });
  it('compone mensajes, auditoría y catálogo solo con filas autorizadas', () => {
    const reads: ConnectedReads = {
      appointments: [{ ...appointment }],
      professionals: [{ id: P, name: 'Dra. Demo', active: true }],
      services: [{ id: S, name: 'Limpieza demo', duration_minutes: 60, price_minor: 30000, active: true }],
      hours: [{ weekday: 1, opens_at: '08:00:00', closes_at: '17:00:00' }],
      proposals: [
        {
          id: PROP, branch_id: B, conversation_id: CONV, run_id: RUN, operation: 'book',
          command: { patient_label: 'Ana Ficticia', professional_id: P, service_id: S, starts_at: '2026-11-02T15:00:00.000Z' },
          status: 'pending', created_at: '2026-11-01T12:00:00.000Z',
        },
      ],
      receipts: [],
      decisions: [],
      messages: [
        { id: M1, conversation_id: CONV, run_id: RUN0, role: 'user', content: 'Hola', result_kind: null },
        { id: M2, conversation_id: CONV, run_id: RUN, role: 'assistant', content: 'Pendiente', result_kind: 'proposal' },
      ],
      sources: [{ id: SRC, title: 'Horario', content: 'Lun a vie', content_hash: 'a'.repeat(64) }],
      messageSources: [{ message_id: M2, source_id: SRC }],
    };
    const view = buildConnectedView(reads, TZ);
    expect(view.appointments).toHaveLength(1);
    expect(view.messages).toHaveLength(2);
    expect(view.messages[1].result?.proposals).toHaveLength(1);
    expect(view.messages[1].result?.sources[0].title).toBe('Horario');
    expect(view.audit).toEqual([]);
    expect(view.hoursNote).toContain('lun');
  });
});
