import { z } from 'zod';
import { DomainError } from './agenda';
import type { Proposal, Workspace } from './types';

export const resultSchema = z.strictObject({
  kind: z.enum(['answer', 'needs_input', 'proposal']),
  text: z.string().trim().min(1).max(2000),
  sourceIds: z.array(z.string().min(1).max(100)).max(5),
  proposalIds: z.array(z.uuid()).max(20),
});
export type ResultDraft = z.infer<typeof resultSchema>;
export type SourceEvidence = { id: string; title: string; content: string; version: string };
export type VerifiedResult = {
  kind: ResultDraft['kind'] | 'paused' | 'failed';
  text: string;
  // This field is server-owned. Conversational output can never be an execution receipt.
  execution: 'none';
  sources: SourceEvidence[];
  proposals: Proposal[];
};

export function verifyResult(
  raw: unknown,
  state: Workspace,
  sources: Map<string, SourceEvidence>,
  proposalIds: Set<string>,
): VerifiedResult {
  const parsed = resultSchema.safeParse(raw);
  if (!parsed.success) throw new DomainError('Resultado conversacional inválido.');
  const draft = parsed.data;
  const resolvedSources = [...new Set(draft.sourceIds)].map((id) => {
    const source = sources.get(id);
    if (!source) throw new DomainError('La fuente no fue recuperada en este turno.');
    return source;
  });
  const proposals = [...new Set(draft.proposalIds)].map((id) => {
    const proposal = state.proposals.find((p) => p.id === id && p.status === 'pending');
    if (!proposal || !proposalIds.has(id))
      throw new DomainError('La propuesta no pertenece a este turno.');
    return structuredClone(proposal);
  });
  if ((draft.kind === 'proposal') !== proposals.length > 0 || proposals.length !== proposalIds.size)
    throw new DomainError('El resultado no corresponde a las propuestas preparadas.');
  return {
    kind: draft.kind,
    execution: 'none',
    // Action state is exclusively server text; model prose cannot announce a write.
    text:
      draft.kind === 'proposal'
        ? 'Pending confirmation. Review the card and click to apply the change.'
        : draft.text,
    sources: resolvedSources,
    proposals,
  };
}

export function executionReceipt(state: Workspace, proposalId: string) {
  const proposal = state.proposals.find((p) => p.id === proposalId);
  const event = state.audit.find((e) => e.id === proposalId);
  const appointment = state.appointments.find((a) => a.id === proposal?.resultId);
  if (
    proposal?.status !== 'confirmed' ||
    !event ||
    !appointment ||
    event.appointmentId !== appointment.id
  )
    return null;
  if (
    !proposal.receipt ||
    proposal.receipt.proposalId !== proposalId ||
    proposal.receipt.appointment.id !== event.appointmentId
  )
    return null;
  return structuredClone(proposal.receipt);
}
