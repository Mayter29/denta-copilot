import { CalendarCheck2, Check, X } from 'lucide-react';
import {
  doctors as localDoctors,
  services as localServices,
  type Proposal,
} from '@/lib/domain/types';
const labels = {
  book: 'Agendar cita',
  cancel: 'Cancelar cita',
  reschedule: 'Reagendar cita',
  follow_up: 'Preparar seguimiento simulado',
};
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
  doctors = localDoctors,
  services = localServices,
}: {
  proposal: Proposal;
  busy: boolean;
  onDecide: (id: string, approved: boolean) => void;
  doctors?: { id: string; name: string }[];
  services?: { id: string; name: string }[];
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
      {c.message ? (
        <blockquote>
          <strong>Mensaje para el canal simulado:</strong>
          <p>{c.message}</p>
        </blockquote>
      ) : null}
      {proposal.receipt ? (
        <details>
          <summary>Comprobante de ejecución</summary>
          <p className="small">
            Cita: {proposal.receipt.appointment.id} · Estado: {proposal.receipt.appointment.status}{' '}
            · Versión: {proposal.receipt.appointment.version}
          </p>
          <p className="small">
            Confirmación: {proposal.receipt.proposalId} · {proposal.receipt.at}
          </p>
        </details>
      ) : null}
      {proposal.status === 'pending' ? (
        <>
          <p className="muted small">
            {c.action === 'follow_up'
              ? 'Solo se agrega al canal simulado al confirmar. No envía WhatsApp.'
              : 'El espacio se vuelve a validar al confirmar.'}{' '}
            Vigencia: 10 minutos.
          </p>
          <div className="proposal-buttons">
            <button className="primary" disabled={busy} onClick={() => onDecide(proposal.id, true)}>
              <Check size={16} />
              {c.action === 'follow_up' ? 'Confirmar mensaje simulado' : 'Confirmar cambio'}
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
            ? c.action === 'follow_up'
              ? 'Guardado en el canal simulado de esta sesión.'
              : 'Guardado en la agenda de esta sesión de demostración.'
            : 'La agenda conserva su estado anterior.'}
        </p>
      )}
    </article>
  );
}
