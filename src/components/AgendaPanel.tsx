import { CalendarDays, Clock3 } from 'lucide-react';
import { doctors, services, type Workspace } from '@/lib/domain/types';

const attendanceLabel = {
  confirmed: 'Confirmed',
  unconfirmed: 'Unconfirmed',
  no_show: 'No-show',
};

export function AgendaPanel({
  state,
  date,
  onDate,
}: {
  state: Workspace;
  date: string;
  onDate: (value: string) => void;
}) {
  const appointments = state.appointments
    .filter((appointment) => appointment.date === date && appointment.status === 'scheduled')
    .sort((a, b) => a.time.localeCompare(b.time));
  const queue = state.appointments
    .filter(
      (appointment) =>
        appointment.status === 'scheduled' &&
        (appointment.attendance === 'unconfirmed' || appointment.attendance === 'no_show'),
    )
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  return (
    <div className="schedule-pane">
      <div className="context-heading">
        <div>
          <span className="eyebrow">RECEPTION</span>
          <h2>Schedule</h2>
        </div>
      </div>
      <section className="follow-queue" aria-label="Needs a follow-up">
        <h3>Needs a follow-up</h3>
        {queue.length ? (
          <ul>
            {queue.map((appointment) => (
              <li key={appointment.id}>
                <span className={`attend attend-${appointment.attendance}`}>
                  {attendanceLabel[appointment.attendance]}
                </span>
                <strong>{appointment.patient.replace(' (demo)', '')}</strong>
                <span>
                  {appointment.date} · {appointment.time}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p>Everyone on the book is confirmed.</p>
        )}
      </section>
      <label className="date-picker">
        Schedule date
        <input
          type="date"
          value={date}
          onInput={(event) => onDate(event.currentTarget.value)}
          onChange={(event) => onDate(event.target.value)}
        />
      </label>
      <div className="agenda-count">
        <span>
          {appointments.length} visit{appointments.length === 1 ? '' : 's'}
        </span>
        <span className="badge soft">Costa Rica</span>
      </div>
      <div className="appointment-list">
        {appointments.length ? (
          appointments.map((appointment) => (
            <article className="appointment" key={appointment.id}>
              <div className="appointment-time">
                <strong>{appointment.time}</strong>
                <span>{appointment.duration} min</span>
              </div>
              <div className={`appointment-body ${appointment.doctorId}`}>
                <span className="small muted">
                  {services.find((service) => service.id === appointment.serviceId)?.name}
                </span>
                <h3>{appointment.patient.replace(' (demo)', '')}</h3>
                <p>{doctors.find((doctor) => doctor.id === appointment.doctorId)?.name}</p>
                <span className={`attend attend-${appointment.attendance}`}>
                  {attendanceLabel[appointment.attendance]}
                </span>
              </div>
            </article>
          ))
        ) : (
          <div className="empty-agenda">
            <CalendarDays size={28} aria-hidden="true" />
            <p>No visits on this day.</p>
            <span>Ask Denta for an opening, or pick another date.</span>
          </div>
        )}
      </div>
      <div className="hours-note">
        <Clock3 size={17} aria-hidden="true" />
        <div>
          <strong>Clinic hours</strong>
          <p>Mon–Fri 8:00–17:00 · Sat 8:00–12:00</p>
        </div>
      </div>
    </div>
  );
}
