import { CalendarCheck2, Check, MessageCircle, X } from 'lucide-react';
import { doctors, services, type Proposal } from '@/lib/domain/types';

const labels = {
  book: 'Book appointment',
  cancel: 'Cancel appointment',
  reschedule: 'Move appointment',
  follow_up: 'Follow up',
};
const states = {
  pending: 'Waiting for you',
  confirmed: 'Applied',
  rejected: 'Dismissed',
  expired: 'Expired',
};
const serviceNames: Record<string, string> = {
  evaluation: 'Evaluation',
  cleaning: 'Cleaning',
};

export function ProposalCard({
  proposal,
  busy,
  onDecide,
}: {
  proposal: Proposal;
  busy: boolean;
  onDecide: (id: string, approved: boolean) => void;
}) {
  const change = proposal.change;
  const followUp = change.action === 'follow_up';
  return (
    <article className={`proposal ${proposal.status}`}>
      <div className="proposal-title">
        {followUp ? <MessageCircle size={19} /> : <CalendarCheck2 size={19} />}
        <strong>{labels[change.action]}</strong>
        <span className="badge">{states[proposal.status]}</span>
      </div>
      <p className="patient-name">{change.patient}</p>
      {followUp && change.note ? (
        <blockquote className="patient-draft" lang="es">
          {change.note}
        </blockquote>
      ) : null}
      <dl className="proposal-details">
        <div>
          <dt>Service</dt>
          <dd>
            {serviceNames[change.serviceId] ??
              services.find((s) => s.id === change.serviceId)?.name}
          </dd>
        </div>
        <div>
          <dt>Clinician</dt>
          <dd>{doctors.find((d) => d.id === change.doctorId)?.name}</dd>
        </div>
        <div>
          <dt>When</dt>
          <dd>
            {change.date} · {change.time}
          </dd>
        </div>
      </dl>
      {proposal.receipt ? (
        <details>
          <summary>Server receipt</summary>
          <p className="small">
            Appointment {proposal.receipt.appointment.id} · {proposal.receipt.appointment.status} ·
            version {proposal.receipt.appointment.version}
          </p>
          <p className="small">
            Confirmation {proposal.receipt.proposalId} · {proposal.receipt.at}
          </p>
        </details>
      ) : null}
      {proposal.status === 'pending' ? (
        <>
          <p className="muted small">
            {followUp
              ? 'Confirming records the Spanish message in the simulated patient chat. It is not sent on WhatsApp.'
              : 'The slot is checked again when you confirm. The card expires in 10 minutes.'}
          </p>
          <div className="proposal-buttons">
            <button
              className="primary"
              type="button"
              disabled={busy}
              onClick={() => onDecide(proposal.id, true)}
            >
              <Check size={16} />
              {followUp ? 'Confirm message' : 'Confirm change'}
            </button>
            <button
              className="secondary"
              type="button"
              disabled={busy}
              onClick={() => onDecide(proposal.id, false)}
            >
              <X size={16} />
              Dismiss
            </button>
          </div>
        </>
      ) : (
        <p className="small muted">
          {proposal.status === 'confirmed'
            ? followUp
              ? 'Recorded in the simulated thread for this demo session.'
              : 'Saved in this demo session’s schedule.'
            : 'The schedule and patient thread were left unchanged.'}
        </p>
      )}
    </article>
  );
}
