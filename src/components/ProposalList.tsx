'use client';
import type { Proposal } from '@/lib/domain/types';
import { ProposalCard } from './ProposalCard';
import { BatchProposalCard } from './BatchProposalCard';

type Names = { id: string; name: string }[];

/**
 * Verified proposal cards: batch groups render with per-row and confirm-all
 * actions, singles render individually. Clicks only; no auto-confirm.
 */
export function ProposalList({
  proposals,
  busy,
  doctors,
  services,
  onDecide,
  onDecideBatch,
}: {
  proposals: Proposal[];
  busy: boolean;
  doctors?: Names;
  services?: Names;
  onDecide: (id: string, approved: boolean) => void;
  onDecideBatch?: (batchId: string, approved: boolean) => void;
}) {
  const decideBatch = onDecideBatch;
  const groups = new Map<string, Proposal[]>();
  if (decideBatch) {
    for (const proposal of proposals) {
      const batchId = proposal.change.batchId;
      if (!batchId) continue;
      const list = groups.get(batchId) ?? [];
      list.push(proposal);
      groups.set(batchId, list);
    }
  }
  const batched = new Set(groups.keys());
  return (
    <>
      {decideBatch
        ? [...groups.entries()].map(([batchId, group]) => (
            <BatchProposalCard
              key={batchId}
              proposals={group}
              busy={busy}
              onDecide={onDecide}
              onDecideBatch={decideBatch}
              doctors={doctors}
              services={services}
            />
          ))
        : null}
      {proposals
        .filter((p) => !p.change.batchId || !batched.has(p.change.batchId))
        .map((proposal) => (
          <ProposalCard
            key={proposal.id}
            proposal={proposal}
            busy={busy}
            onDecide={onDecide}
            doctors={doctors}
            services={services}
          />
        ))}
    </>
  );
}
