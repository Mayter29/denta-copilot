import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCopilotStore } from './copilot-store';
import { DomainError } from '../domain/agenda';
import { RequestError } from './workspace';

const rpc = vi.hoisted(() => vi.fn());
const client = { rpc } as never;
const actor = '00000000-0000-4000-8000-000000000001';
const tenant = '10000000-0000-4000-8000-000000000001';
const branch = '20000000-0000-4000-8000-000000000001';
const run = '30000000-0000-4000-8000-000000000001';
const conversation = '40000000-0000-4000-8000-000000000001';
const request = '50000000-0000-4000-8000-000000000001';

afterEach(() => {
  rpc.mockReset();
});

describe('adaptador de persistencia Supabase', () => {
  it('envía p_actor de la sesión verificada, nunca del body', async () => {
    rpc.mockResolvedValue({ data: '60000000-0000-4000-8000-000000000001', error: null });
    const store = createCopilotStore(client);
    await store.openConversation({ actor, tenantId: tenant, branchId: branch });
    expect(rpc).toHaveBeenCalledWith('dc_open_conversation', {
      p_actor: actor,
      p_tenant: tenant,
      p_branch: branch,
    });
    await store.decideDemoProposal({ actor, proposalId: run, approved: true });
    expect(rpc).toHaveBeenCalledWith('dc_decide_demo_proposal', {
      p_actor: actor,
      p_proposal: run,
      p_approved: true,
    });
  });
  it('propone con comando congelado y rechaza entradas inválidas antes de la red', async () => {
    rpc.mockResolvedValue({ data: run, error: null });
    const store = createCopilotStore(client);
    await store.proposeDemoAppointment({
      actor,
      runId: run,
      requestId: request,
      operation: 'book',
      patient: 'Marina Ficticia',
      professionalId: tenant,
      serviceId: branch,
      startsAt: '2026-11-02T15:00:00.000Z',
    });
    const args = rpc.mock.calls[0][1] as Record<string, unknown>;
    expect(args.p_operation).toBe('book');
    expect(args.p_patient).toBe('Marina Ficticia');
    await expect(
      store.proposeDemoAppointment({ actor: 'no-uuid', runId: run, requestId: request, operation: 'book' }),
    ).rejects.toThrow();
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it('mapea acceso denegado a 403 sin filtrar detalles del proveedor', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'access_denied' } });
    const store = createCopilotStore(client);
    const error = await store.openConversation({ actor, tenantId: tenant, branchId: branch }).catch((e) => e);
    expect(error).toBeInstanceOf(RequestError);
    expect(error.status).toBe(403);
  });
  it('mapea conflictos y versiones a 409 para reintento explícito', async () => {
    for (const message of ['slot_conflict', 'stale_appointment', 'run_already_active']) {
      rpc.mockResolvedValue({ data: null, error: { code: '40001', message } });
      const store = createCopilotStore(client);
      const error = await store.beginRun({
        actor, conversationId: conversation, requestId: request,
        promptVersion: 'v1', model: 'muse-spark', text: 'Hola',
      }).catch((e) => e);
      expect(error).toBeInstanceOf(DomainError);
    }
  });
  it('publica solo con referencias verificadas del turno', async () => {
    rpc.mockResolvedValue({
      data: { kind: 'proposal', text: 'Pendiente', execution: 'none', proposal_ids: [run], source_ids: [] },
      error: null,
    });
    const store = createCopilotStore(client);
    const result = await store.publishRun({
      actor, runId: run, kind: 'proposal', text: 'Pendiente', proposalIds: [run], sourceIds: [],
    });
    expect(result.execution).toBe('none');
    expect(rpc).toHaveBeenCalledWith('dc_publish_run', expect.objectContaining({ p_kind: 'proposal' }));
  });
});
