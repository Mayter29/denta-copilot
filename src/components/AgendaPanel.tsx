import { CalendarDays, Clock3, ArrowUpRight, BookOpen, History } from 'lucide-react';
import type { Workspace } from '@/lib/domain/types';
import { doctors as localDoctors, services as localServices } from '@/lib/domain/types';
import { knowledge as localKnowledge } from '@/lib/domain/knowledge';

export type AgendaCatalog = {
  doctors: { id: string; name: string }[];
  services: { id: string; name: string }[];
  knowledge: { id: string; title: string; content: string }[];
  hoursNote: string;
  timeZone: string;
};
export const LOCAL_CATALOG: AgendaCatalog = {
  doctors: localDoctors,
  services: localServices,
  knowledge: localKnowledge,
  hoursNote: 'Lun–vie 8:00–17:00 · Sáb 8:00–12:00',
  timeZone: 'America/Costa_Rica',
};
export function AgendaPanel({
  state,
  date,
  onDate,
  tab,
  onTab,
  catalog = LOCAL_CATALOG,
}: {
  state: Workspace;
  date: string;
  onDate: (v: string) => void;
  tab: string;
  onTab: (v: string) => void;
  catalog?: AgendaCatalog;
}) {
  const appointments = state.appointments
    .filter((a) => a.date === date && a.status === 'scheduled')
    .sort((a, b) => a.time.localeCompare(b.time));
  return (
    <aside className="context-panel" aria-label="Contexto de la clínica">
      <div className="context-tabs" role="tablist" aria-label="Contexto">
        <button role="tab" aria-selected={tab === 'agenda'} onClick={() => onTab('agenda')}>
          <CalendarDays size={16} />
          Agenda
        </button>
        <button role="tab" aria-selected={tab === 'knowledge'} onClick={() => onTab('knowledge')}>
          <BookOpen size={16} />
          Fuentes
        </button>
        <button
          role="tab"
          aria-label="Actividad"
          aria-selected={tab === 'audit'}
          onClick={() => onTab('audit')}
        >
          <History size={16} />
        </button>
      </div>
      {tab === 'agenda' ? (
        <>
          <div className="context-heading">
            <div>
              <span className="eyebrow">TU CLÍNICA, AL DÍA</span>
              <h2>Agenda de citas</h2>
            </div>
            <ArrowUpRight size={20} />
          </div>
          <label className="date-picker">
            Fecha de la agenda
            <input
              type="date"
              value={date}
              onInput={(e) => onDate(e.currentTarget.value)}
              onChange={(e) => onDate(e.target.value)}
            />
          </label>
          <div className="agenda-count">
            <span>{appointments.length} citas programadas</span>
            <span className="badge soft">{catalog.timeZone.replace('_', ' ')}</span>
          </div>
          <div className="appointment-list">
            {appointments.length ? (
              appointments.map((a) => (
                <article className="appointment" key={a.id}>
                  <div className="appointment-time">
                    <strong>{a.time}</strong>
                    <span>{a.duration} min</span>
                  </div>
                  <div className={`appointment-body ${a.doctorId}`}>
                    <span className="small muted">
                      {catalog.services.find((s) => s.id === a.serviceId)?.name}
                    </span>
                    <h3>{a.patient}</h3>
                    <p>{catalog.doctors.find((d) => d.id === a.doctorId)?.name}</p>
                    <span className="appointment-status">
                      <span />
                      Programada
                    </span>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-agenda">
                <CalendarDays size={28} />
                <p>No hay citas para este día.</p>
                <span>Pedile al copiloto que consulte un espacio.</span>
              </div>
            )}
          </div>
          <div className="hours-note">
            <Clock3 size={17} />
            <div>
              <strong>Horario de atención</strong>
              <p>{catalog.hoursNote}</p>
            </div>
          </div>
        </>
      ) : tab === 'knowledge' ? (
        <>
          <div className="context-heading">
            <div>
              <span className="eyebrow">CONTEXTO VERIFICABLE</span>
              <h2>Conocimiento de la clínica</h2>
            </div>
          </div>
          <p className="muted small">
            Fuentes ficticias consultables por el agente. Recuperación por texto en esta primera
            versión.
          </p>
          {catalog.knowledge.map((k) => (
            <article className="source" key={k.id}>
              <BookOpen size={17} />
              <div>
                <h3>{k.title}</h3>
                <p>{k.content}</p>
              </div>
            </article>
          ))}
        </>
      ) : (
        <>
          <div className="context-heading">
            <div>
              <span className="eyebrow">CAMBIOS CONFIRMADOS</span>
              <h2>Actividad de la sesión</h2>
            </div>
          </div>
          {state.audit.length ? (
            state.audit.toReversed().map((a) => (
              <article className="source" key={a.id}>
                <CalendarDays size={17} />
                <div>
                  <h3>
                    {
                      {
                        book: 'Cita agendada',
                        cancel: 'Cita cancelada',
                        reschedule: 'Cita reagendada',
                      }[a.action]
                    }
                  </h3>
                  <p>
                    {new Date(a.at).toLocaleString('es-CR', { timeZone: catalog.timeZone })}
                  </p>
                  <p>Confirmación registrada por el servidor.</p>
                </div>
              </article>
            ))
          ) : (
            <p className="muted">Los cambios aparecerán aquí después de confirmarlos.</p>
          )}
        </>
      )}
      <div className="demo-note">
        <span className="status-dot" />
        <p>
          <strong>Entorno de demostración</strong>
          <br />
          Personas y datos completamente ficticios.
        </p>
      </div>
    </aside>
  );
}
