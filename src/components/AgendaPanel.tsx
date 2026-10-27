import { CalendarDays, Clock3, BookOpen, History } from 'lucide-react';
import type { Workspace } from '@/lib/domain/types';
import { doctors, services } from '@/lib/domain/types';
import { knowledge } from '@/lib/domain/knowledge';

const serviceNames: Record<string, string> = {
  evaluation: 'Evaluation',
  cleaning: 'Cleaning',
};
const outreachLabels = {
  confirmed: 'Confirmed',
  unconfirmed: 'Not confirmed',
  no_show: 'No-show',
};
const auditLabels: Record<string, string> = {
  book: 'Appointment booked',
  cancel: 'Appointment cancelled',
  reschedule: 'Appointment moved',
  follow_up: 'Follow-up recorded',
};

export function AgendaPanel({
  state,
  date,
  onDate,
  tab,
  onTab,
  selectedId,
  onSelect,
}: {
  state: Workspace;
  date: string;
  onDate: (value: string) => void;
  tab: string;
  onTab: (value: string) => void;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const appointments = state.appointments
    .filter((appointment) => appointment.date === date && appointment.status === 'scheduled')
    .sort((a, b) => a.time.localeCompare(b.time));
  const queue = state.appointments.filter(
    (appointment) => appointment.status === 'scheduled' && appointment.outreach !== 'confirmed',
  );
  return (
    <section className="agenda-panel" aria-labelledby="agenda-heading">
      <div className="context-tabs" role="tablist" aria-label="Clinic context">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'agenda'}
          onClick={() => onTab('agenda')}
        >
          <CalendarDays size={16} />
          Schedule
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'knowledge'}
          onClick={() => onTab('knowledge')}
        >
          <BookOpen size={16} />
          Sources
        </button>
        <button
          type="button"
          role="tab"
          aria-label="Activity"
          aria-selected={tab === 'audit'}
          onClick={() => onTab('audit')}
        >
          <History size={16} />
        </button>
      </div>
      {tab === 'agenda' ? (
        <div className="panel-scroll">
          <div className="context-heading">
            <div>
              <p className="eyebrow">1 · Today’s book</p>
              <h2 id="agenda-heading">Schedule</h2>
            </div>
          </div>
          <div className="queue">
            <h3>Needs a follow-up</h3>
            {queue.length ? (
              <ul>
                {queue.map((appointment) => (
                  <li key={appointment.id}>
                    <button
                      type="button"
                      className={appointment.id === selectedId ? 'is-selected' : ''}
                      aria-pressed={appointment.id === selectedId}
                      onClick={() => onSelect(appointment.id)}
                    >
                      <span className={`outreach ${appointment.outreach}`}>
                        {outreachLabels[appointment.outreach]}
                      </span>
                      <strong>{appointment.patient}</strong>
                      <span>
                        {appointment.date} · {appointment.time}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">Everyone on the book is confirmed.</p>
            )}
          </div>
          <label className="date-picker">
            Schedule date
            <input
              type="date"
              value={date}
              onInput={(event) => onDate(event.currentTarget.value)}
              onChange={(event) => onDate(event.target.value)}
            />
          </label>
          <p className="agenda-count">
            <span>
              {appointments.length} visit{appointments.length === 1 ? '' : 's'}
            </span>
            <span className="badge soft">Costa Rica</span>
          </p>
          <div className="appointment-list">
            {appointments.length ? (
              appointments.map((appointment) => (
                <button
                  className={`appointment ${appointment.id === selectedId ? 'is-selected' : ''}`}
                  key={appointment.id}
                  type="button"
                  aria-pressed={appointment.id === selectedId}
                  onClick={() => onSelect(appointment.id)}
                >
                  <span className="appointment-time">
                    <strong>{appointment.time}</strong>
                    <span>{appointment.duration} min</span>
                  </span>
                  <span className={`appointment-body ${appointment.doctorId}`}>
                    <span className="small muted">
                      {serviceNames[appointment.serviceId] ??
                        services.find((service) => service.id === appointment.serviceId)?.name}
                    </span>
                    <strong className="appointment-patient">{appointment.patient}</strong>
                    <span className="appointment-doctor">
                      {doctors.find((doctor) => doctor.id === appointment.doctorId)?.name}
                    </span>
                    <span className={`outreach ${appointment.outreach}`}>
                      {outreachLabels[appointment.outreach]}
                    </span>
                  </span>
                </button>
              ))
            ) : (
              <div className="empty-agenda">
                <CalendarDays size={28} />
                <p>No visits on this day.</p>
                <span>Ask Denta for an opening, or pick another date.</span>
              </div>
            )}
          </div>
          <div className="hours-note">
            <Clock3 size={17} />
            <div>
              <strong>Clinic hours</strong>
              <p>Mon–Fri 8:00–17:00 · Sat 8:00–12:00</p>
            </div>
          </div>
        </div>
      ) : tab === 'knowledge' ? (
        <div className="panel-scroll">
          <div className="context-heading">
            <div>
              <p className="eyebrow">Sources Denta can cite</p>
              <h2 id="agenda-heading">Clinic knowledge</h2>
            </div>
          </div>
          <p className="muted small">
            Fictional notes. The text is in Spanish, as the clinic would write it.
          </p>
          {knowledge.map((source) => (
            <article className="source" key={source.id} lang="es">
              <BookOpen size={17} />
              <div>
                <h3>{source.title}</h3>
                <p>{source.content}</p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="panel-scroll">
          <div className="context-heading">
            <div>
              <p className="eyebrow">Confirmed in this session</p>
              <h2 id="agenda-heading">Activity</h2>
            </div>
          </div>
          {state.audit.length ? (
            state.audit.toReversed().map((event) => (
              <article className="source" key={event.id}>
                <CalendarDays size={17} />
                <div>
                  <h3>{auditLabels[event.action] ?? event.action}</h3>
                  <p>
                    {new Date(event.at).toLocaleString('en-US', { timeZone: 'America/Costa_Rica' })}
                  </p>
                  <p>Recorded by the server after a click.</p>
                </div>
              </article>
            ))
          ) : (
            <p className="empty-copy">Confirmed changes and follow-ups show up here.</p>
          )}
        </div>
      )}
      <p className="demo-note">
        <span className="status-dot" />
        Fictional people only. Nothing here is a real patient record.
      </p>
    </section>
  );
}
