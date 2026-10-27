import { CalendarCheck2, Check, X } from 'lucide-react';
import { doctors, services, type Proposal } from '@/lib/domain/types';
const labels = { book: 'Agendar cita', cancel: 'Cancelar cita', reschedule: 'Reagendar cita' };
const states = {
  pending: 'Pendiente de tu confirmación',
  confirmed: 'Cambio aplicado',
  rejected: 'Propuesta descartada',
  expired: 'Propuesta vencida',
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
  const c = proposal.change;
  return (
    <article className={`proposal ${proposal.status}`}>
      <div className="proposal-title">
        <CalendarCheck2 size={19} />
        <strong>{labels[c.action]}</strong>
        <span className="badge">{states[proposal.status]}</span>
      </div>
      <p className="patient-name">{c.patient}</p>
      <dl className="proposal-details">
        <div>
          <dt>Servicio</dt>
          <dd>{services.find((s) => s.id === c.serviceId)?.name}</dd>
        </div>
        <div>
          <dt>Profesional</dt>
          <dd>{doctors.find((d) => d.id === c.doctorId)?.name}</dd>
        </div>
        <div>
          <dt>Fecha</dt>
          <dd>
            {c.date} · {c.time}
          </dd>
        </div>
      </dl>
      {proposal.status === 'pending' ? (
        <>
          <p className="muted small">
            El espacio se vuelve a validar al confirmar. Vigencia: 10 minutos.
          </p>
          <div className="proposal-buttons">
            <button className="primary" disabled={busy} onClick={() => onDecide(proposal.id, true)}>
              <Check size={16} />
              Confirmar cambio
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => onDecide(proposal.id, false)}
            >
              <X size={16} />
              Descartar
            </button>
          </div>
        </>
      ) : (
        <p className="small muted">
          {proposal.status === 'confirmed'
            ? 'Guardado en la agenda de esta sesión de demostración.'
            : 'La agenda conserva su estado anterior.'}
        </p>
      )}
    </article>
  );
}
