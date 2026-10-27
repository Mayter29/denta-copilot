import { CalendarCheck2, Check, MessageCircle, X } from 'lucide-react';
import { doctors, services, type Proposal } from '@/lib/domain/types';

const labels = {
  book: 'Schedule visit',
  cancel: 'Cancel visit',
  reschedule: 'Reschedule visit',
  follow_up: 'Send follow-up',
};
const states = {
  pending: 'Waiting for you',
  confirmed: 'Applied',
  rejected: 'Dismissed',
  expired: 'Expired',
};
const reasons = { unconfirmed: 'Has not confirmed', no_show: 'No-show' };

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
        {followUp ? (
          <MessageCircle size={19} aria-hidden="true" />
        ) : (
          <CalendarCheck2 size={19} aria-hidden="true" />
        )}
        <strong>{labels[change.action]}</strong>
        <span className="badge">{states[proposal.status]}</span>
      </div>
      <p className="patient-name">{change.patient.replace(' (demo)', '')}</p>
      <dl className="proposal-details">
        <div>
          <dt>Service</dt>
          <dd>{services.find((service) => service.id === change.serviceId)?.name}</dd>
        </div>
        <div>
          <dt>Clinician</dt>
          <dd>{doctors.find((doctor) => doctor.id === change.doctorId)?.name}</dd>
        </div>
        <div>
          <dt>When</dt>
          <dd>
            {change.date} · {change.time}
          </dd>
        </div>
        {change.reason ? (
          <div>
            <dt>Why</dt>
            <dd>{reasons[change.reason]}</dd>
          </div>
        ) : null}
      </dl>
      {change.message ? (
        <blockquote className="patient-quote" lang="es">
          <span lang="en">Patient will read</span>
          {change.message}
        </blockquote>
      ) : null}
      {proposal.receipt ? (
        <details>
          <summary>Server receipt</summary>
          <p className="small">
            Visit {proposal.receipt.appointment.id} · {proposal.receipt.appointment.status} ·
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
              ? 'The message is sent only if you confirm. The card expires in 10 minutes.'
              : 'The opening is checked again when you confirm. The card expires in 10 minutes.'}
          </p>
          <div className="proposal-buttons">
            <button
              className="primary"
              type="button"
              disabled={busy}
              onClick={() => onDecide(proposal.id, true)}
            >
              <Check size={16} aria-hidden="true" />
              {followUp ? 'Send to patient' : 'Confirm change'}
            </button>
            <button
              className="secondary"
              type="button"
              disabled={busy}
              onClick={() => onDecide(proposal.id, false)}
            >
              <X size={16} aria-hidden="true" />
              Dismiss
            </button>
          </div>
        </>
      ) : (
        <p className="small muted">
          {proposal.status === 'confirmed'
            ? followUp
              ? 'Sent to the simulated patient channel.'
              : 'Saved in this demo session.'
            : 'The schedule was left unchanged.'}
        </p>
      )}
    </article>
  );
}
