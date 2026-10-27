import { doctors, type Proposal, type Workspace } from '@/lib/domain/types';
import { DentaMascot } from '../brand/DentaMascot';

export function PatientThread({
  state,
  selectedId,
  onSelect,
}: {
  state: Workspace;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const appointment = state.appointments.find((item) => item.id === selectedId);
  const messages = state.patientMessages.filter((message) => message.appointmentId === selectedId);
  const drafts = state.proposals.filter(
    (proposal) =>
      proposal.status === 'pending' &&
      proposal.change.action === 'follow_up' &&
      proposal.change.appointmentId === selectedId &&
      proposal.change.note,
  );
  return (
    <section className="thread" aria-labelledby="thread-heading">
      <div className="thread-banner">
        <p className="eyebrow">3 · Patient preview</p>
        <h2 id="thread-heading">Simulated chat</h2>
        <p>Spanish messages for the jury. This is not WhatsApp and nothing is delivered.</p>
      </div>
      <div className="thread-people" role="group" aria-label="Patients">
        {state.appointments
          .filter((item) => item.status === 'scheduled')
          .map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={item.id === selectedId}
              className={item.id === selectedId ? 'is-selected' : ''}
              onClick={() => onSelect(item.id)}
            >
              {item.patient.replace(' (demo)', '')}
            </button>
          ))}
      </div>
      {appointment ? (
        <>
          <div className="thread-contact">
            <div>
              <strong lang="es">{appointment.patient}</strong>
              <span>
                {doctors.find((doctor) => doctor.id === appointment.doctorId)?.name} ·{' '}
                {appointment.time}
              </span>
            </div>
            <span className="thread-live">Preview</span>
          </div>
          <div className="thread-stream" aria-live="polite">
            {messages.length || drafts.length ? (
              <>
                {messages.map((message) => (
                  <article
                    key={message.id}
                    className={`bubble ${message.direction === 'inbound' ? 'in' : 'out'}`}
                    lang="es"
                  >
                    <p>{message.body}</p>
                    <time dateTime={message.at}>
                      {message.direction === 'inbound' ? 'Patient' : 'Clinic'} ·{' '}
                      {new Date(message.at).toLocaleTimeString('es-CR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'America/Costa_Rica',
                      })}
                    </time>
                  </article>
                ))}
                {drafts.map((proposal) => (
                  <DraftBubble key={proposal.id} proposal={proposal} />
                ))}
              </>
            ) : (
              <div className="thread-empty">
                <DentaMascot size={72} blink={false} />
                <p>No messages for this visit yet.</p>
              </div>
            )}
          </div>
          <p className="thread-lock">
            Denta drafts the Spanish text. It appears here as sent only after you confirm the card.
          </p>
        </>
      ) : (
        <div className="thread-empty">
          <DentaMascot size={72} blink={false} />
          <p>Choose a patient to preview their thread.</p>
        </div>
      )}
    </section>
  );
}

function DraftBubble({ proposal }: { proposal: Proposal }) {
  return (
    <article className="bubble draft">
      <p className="draft-label">Draft · waiting for your confirmation</p>
      <p lang="es">{proposal.change.note}</p>
    </article>
  );
}
