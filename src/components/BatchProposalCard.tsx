'use client';
import { CalendarCheck2, Check, CheckCheck, X } from 'lucide-react';
import { formatClinicDate, type Appointment, type Proposal } from '@/lib/domain/types';

const states: Record<Proposal['status'], string> = {
  pending: 'Pendiente de tu confirmación',
  confirmed: 'Cambio aplicado',
  rejected: 'Propuesta descartada',
  expired: 'Propuesta vencida',
};

function shortPatient(patient: string) {
  return patient.replace(' (demo)', '');
}

export function BatchProposalCard({
  proposals,
  busy,
  onDecide,
  onDecideBatch,
  doctors = [],
  services = [],
  appointments = [],
}: {
  proposals: Proposal[];
  /** Current agenda, to show the original slot of each pending move. */
  appointments?: Appointment[];
  busy: boolean;
  onDecide: (id: string, approved: boolean) => void;
  onDecideBatch: (batchId: string, approved: boolean) => void;
  doctors?: { id: string; name: string }[];
  services?: { id: string; name: string }[];
}) {
  const first = proposals[0];
  if (!first?.change.batchId) return null;
  const batchId = first.change.batchId;
  const pending = proposals.filter((p) => p.status === 'pending');
  const confirmed = proposals.filter((p) => p.status === 'confirmed').length;
  return (
    <article className={`proposal batch ${pending.length ? 'pending' : 'confirmed'}`}>
      <div className="proposal-title">
        <CalendarCheck2 size={19} />
        <strong>
          Reagendar en lote · {proposals.length} {proposals.length === 1 ? 'cita' : 'citas'}
        </strong>
        <span className="badge">
          {confirmed}/{proposals.length} aplicadas
        </span>
      </div>
      {first.change.motivo ? <p className="patient-name">Motivo: {first.change.motivo}</p> : null}
      <ul className="batch-rows">
        {proposals.map((proposal) => {
          const c = proposal.change;
          const before =
            proposal.status === 'pending'
              ? appointments.find((a) => a.id === c.appointmentId)
              : undefined;
          return (
            <li key={proposal.id} className={`batch-row ${proposal.status}`}>
              <div>
                <strong>{shortPatient(c.patient)}</strong>
                <span>
                  {services.find((s) => s.id === c.serviceId)?.name} ·{' '}
                  {doctors.find((d) => d.id === c.doctorId)?.name}
                </span>
                <span>
                  {before ? (
                    <>
                      <s>
                        {formatClinicDate(before.date)} {before.time}
                      </s>{' '}
                      →{' '}
                    </>
                  ) : null}
                  {formatClinicDate(c.date)} · {c.time} · {states[proposal.status]}
                </span>
              </div>
              {proposal.status === 'pending' ? (
                <div className="batch-row-buttons">
                  <button
                    type="button"
                    className="primary"
                    aria-label={`Confirmar ${c.patient}`}
                    disabled={busy}
                    onClick={() => onDecide(proposal.id, true)}
                  >
                    <Check size={15} />
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    aria-label={`Descartar ${c.patient}`}
                    disabled={busy}
                    onClick={() => onDecide(proposal.id, false)}
                  >
                    <X size={15} />
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {pending.length ? (
        <>
          <p className="muted small">
            Cada fila se vuelve a validar al confirmar. Vigencia: 10 minutos. Los parciales se
            reportan por fila.
          </p>
          <div className="proposal-buttons">
            <button className="primary" disabled={busy} onClick={() => onDecideBatch(batchId, true)}>
              <CheckCheck size={16} />
              Confirmar todas ({pending.length})
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => onDecideBatch(batchId, false)}
            >
              <X size={16} />
              Descartar lote
            </button>
          </div>
        </>
      ) : (
        <p className="small muted">Lote resuelto. La agenda conserva los cambios confirmados.</p>
      )}
    </article>
  );
}
