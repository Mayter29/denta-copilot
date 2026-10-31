import { z } from 'zod';
import { DomainError } from './agenda';
import { doctors, formatClinicDate, services, type Proposal, type Workspace } from './types';

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
    text: draft.kind === 'proposal' ? proposalSummary(proposals, state) : draft.text,
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

const nameOf = (list: { id: string; name: string }[], id: string) => list.find((x) => x.id === id)?.name ?? id;
const person = (patient: string) => patient.replace(' (demo)', '');

/** One line per pending change, built only from server data (never model prose). */
function describe(proposal: Proposal, state: Workspace) {
  const c = proposal.change;
  const service = nameOf(services, c.serviceId).toLowerCase();
  // Only «control de ortodoncia» is masculine in the demo catalog.
  const the = c.serviceId === 'ortho_control' ? 'el' : 'la';
  const doctor = nameOf(doctors, c.doctorId);
  const when = `${formatClinicDate(c.date)} a las ${c.time}`;
  if (c.action === 'book') return `Reservar ${service} para ${person(c.patient)} con ${doctor}, ${when}.`;
  if (c.action === 'cancel') return `Cancelar ${the} ${service} de ${person(c.patient)} del ${when} (${doctor}).`;
  if (c.action === 'follow_up')
    return `Agregar un recordatorio al canal simulado de ${person(c.patient)} por su cita del ${when}.`;
  const before = state.appointments.find((a) => a.id === c.appointmentId);
  const from = before ? ` del ${formatClinicDate(before.date)} a las ${before.time}` : '';
  return `Mover ${the} ${service} de ${person(c.patient)}${from} al ${when} (${doctor}).`;
}

/** Server-owned text for a proposal turn: what will change, and that nothing changed yet. */
export function proposalSummary(proposals: Proposal[], state: Workspace) {
  const lines = proposals.map((p) => describe(p, state));
  const head =
    lines.length === 1
      ? `Preparé esta propuesta: ${lines[0]}`
      : [`Preparé ${lines.length} propuestas:`, '', ...lines.map((line) => `- ${line}`)].join('\n');
  return `${head}\n\nTodavía no cambió nada: confirmá en la tarjeta para aplicarlo.`;
}
