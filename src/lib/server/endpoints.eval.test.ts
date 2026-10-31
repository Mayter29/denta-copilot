import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { propose, proposeBatchReschedule, seedWorkspace } from '../domain/agenda';
import type { Workspace } from '../domain/types';
import { POST as confirm } from '../../app/api/proposals/route';
import { POST as patientReply } from '../../app/api/patient-reply/route';
import { POST as transcribe } from '../../app/api/transcribe/route';
import { DELETE as resetDemo } from '../../app/api/workspace/route';
import { withWorkspace } from './workspace';

const memory = vi.hoisted(() => ({ state: undefined as Workspace | undefined }));
vi.mock('./workspace', async (original) => ({
  ...(await original<typeof import('./workspace')>()),
  sessionId: vi.fn(async () => '00000000-0000-4000-8000-000000000001'),
  withWorkspace: vi.fn(async (_id: string, fn: (state: Workspace) => unknown) => fn(memory.state!)),
}));
vi.mock('../domain/wav', () => ({ wavDuration: () => 1 })); // Format validation has its own tests.
const now = new Date('2026-10-27T07:00:00-06:00');
const change = {
  action: 'book' as const,
  patient: 'Persona ficticia',
  doctorId: 'valeria',
  serviceId: 'evaluation',
  date: '2026-10-28',
  time: '11:00',
};
const request = (body: unknown) =>
  new Request('http://127.0.0.1:3420/api/proposals', {
    method: 'POST',
    headers: {
      host: '127.0.0.1:3420',
      origin: 'http://127.0.0.1:3420',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  memory.state = seedWorkspace('2026-10-27');
  vi.useFakeTimers();
  vi.setSystemTime(now);
  vi.stubEnv('DEMO_MODE', 'true');
  vi.clearAllMocks();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it('confirmación recibe solo ID y decisión, rechaza parámetros manipulados', async () => {
  const proposal = propose(memory.state!, change, now);
  const response = await confirm(
    request({ id: proposal.id, approved: true, change: { ...change, time: '12:00' } }),
  );
  expect(response.status).toBe(400);
  expect(memory.state!.audit).toEqual([]);
  expect(memory.state!.proposals[0].status).toBe('pending');
});
it('el endpoint devuelve comprobante del servidor e idempotencia en doble clic', async () => {
  const proposal = propose(memory.state!, change, now);
  const first = await confirm(request({ id: proposal.id, approved: true }));
  const second = await confirm(request({ id: proposal.id, approved: true }));
  expect(first.status).toBe(200);
  const body = await first.json();
  expect(body.receipt.kind).toBe('executed');
  expect(body.receipt.appointment).toEqual(memory.state!.appointments.at(-1));
  expect(body.receipt.appointment).toMatchObject({
    patient: change.patient,
    time: change.time,
    status: 'scheduled',
  });
  expect((await second.json()).receipt).toEqual(body.receipt);
  expect(memory.state!.appointments).toHaveLength(4);
  expect(memory.state!.audit).toHaveLength(1);
});
it('ID ajeno, conflicto y rechazo no emiten comprobantes ni escriben', async () => {
  expect((await confirm(request({ id: randomUUID(), approved: true }))).status).toBe(409);
  const first = propose(memory.state!, change, now);
  const second = propose(memory.state!, { ...change, patient: 'Otra persona demo' }, now);
  await confirm(request({ id: first.id, approved: true }));
  expect((await confirm(request({ id: second.id, approved: true }))).status).toBe(409);
  const rejected = await confirm(request({ id: second.id, approved: false }));
  expect((await rejected.json()).receipt).toBeNull();
  expect(memory.state!.audit).toHaveLength(1);
});
it('el seguimiento confirmado devuelve el hilo simulado sin alterar la agenda ni duplicar el mensaje', async () => {
  const state = memory.state!;
  const appointment = state.appointments.find((item) => item.id === 'demo-luis')!;
  const before = structuredClone(state.appointments);
  const message = 'Hola Luis, ¿podés confirmar tu cita ficticia?';
  const proposal = propose(
    state,
    { ...appointment, action: 'follow_up', appointmentId: appointment.id, message },
    now,
  );
  const first = await confirm(request({ id: proposal.id, approved: true }));
  const repeated = await confirm(request({ id: proposal.id, approved: true }));
  expect(first.status).toBe(200);
  const body = await first.json();
  expect(body.patientThread.at(-1)).toMatchObject({ body: message, proposalId: proposal.id });
  expect((await repeated.json()).patientThread).toEqual(body.patientThread);
  expect(state.appointments).toEqual(before);
  expect(state.audit).toHaveLength(1);
});
it('el lote se confirma por batchId y el doble clic no duplica', async () => {
  const batch = proposeBatchReschedule(
    memory.state!,
    { doctorId: 'valeria', date: '2026-10-27', motivo: 'La doctora no viene hoy.' },
    now,
  );
  expect(batch.proposals).toHaveLength(1);
  const first = await confirm(request({ batchId: batch.batchId, approved: true }));
  expect(first.status).toBe(200);
  const body = await first.json();
  expect(body.batch.confirmed).toHaveLength(1);
  expect(body.batch.failed).toEqual([]);
  const second = await confirm(request({ batchId: batch.batchId, approved: true }));
  expect((await second.json()).batch.confirmed).toEqual([]);
  expect(memory.state!.audit).toHaveLength(1);
  expect(memory.state!.appointments.find((a) => a.id === 'demo-ana')?.date).not.toBe('2026-10-27');
});
it('la respuesta simulada confirma asistencia sin mover la cita', async () => {
  const response = await patientReply(request({ appointmentId: 'demo-luis', reply: 'confirm' }));
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.summary).toContain('confirmó');
  expect(body.appointments[0]).toMatchObject({ id: 'demo-luis', attendance: 'confirmed' });
  expect(memory.state!.appointments.find((a) => a.id === 'demo-luis')).toMatchObject({
    date: '2026-10-27',
    time: '10:30',
  });
  expect((memory.state!.patientThread ?? []).at(-1)).toMatchObject({
    appointmentId: 'demo-luis',
    direction: 'inbound',
  });
  const reschedule = await patientReply(request({ appointmentId: 'demo-ana', reply: 'reschedule' }));
  expect(reschedule.status).toBe(200);
  expect(memory.state!.appointments.find((a) => a.id === 'demo-ana')).toMatchObject({
    date: '2026-10-27',
    status: 'scheduled',
  });
});
it('audio devuelve solo borrador: no abre chat ni propone ni confirma', async () => {
  vi.stubEnv('META_API_KEY', 'fake-test-key');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('Reservá para Marina Ficticia mañana a las once.')),
  );
  const before = structuredClone(memory.state);
  const response = await transcribe(
    new Request('http://127.0.0.1:3420/api/transcribe', {
      method: 'POST',
      headers: { host: '127.0.0.1:3420', origin: 'http://127.0.0.1:3420' },
      body: 'fake-wav-tested-separately',
    }),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    text: 'Reservá para Marina Ficticia mañana a las once.',
  });
  expect(withWorkspace).not.toHaveBeenCalled();
  expect(memory.state).toEqual(before);
});

it('reiniciar la demo vuelve a la semilla ficticia y exige origen local', async () => {
  const state = memory.state!;
  const proposal = propose(state, change, now);
  state.messages.push({ id: 'm1', role: 'user', content: 'hola' });
  const foreign = new Request('http://127.0.0.1:3420/api/workspace', {
    method: 'DELETE',
    headers: { host: '127.0.0.1:3420', origin: 'https://evil.example' },
  });
  expect((await resetDemo(foreign)).status).toBe(403);
  expect(state.proposals).toHaveLength(1);
  const local = new Request('http://127.0.0.1:3420/api/workspace', {
    method: 'DELETE',
    headers: { host: '127.0.0.1:3420', origin: 'http://127.0.0.1:3420' },
  });
  expect((await resetDemo(local)).status).toBe(204);
  expect(state.proposals.some((p) => p.id === proposal.id)).toBe(false);
  expect(state.messages).toEqual([]);
  expect(state.audit).toEqual([]);
  expect(state.appointments.some((a) => a.id === 'demo-show-elena')).toBe(true);
});
