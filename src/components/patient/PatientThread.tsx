'use client';
import { useState } from 'react';
import type { Appointment, PatientMessage } from '@/lib/domain/types';

const attendanceLabel = {
  confirmed: 'Confirmed',
  unconfirmed: 'Awaiting confirmation',
  no_show: 'No-show',
};

const clockFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Costa_Rica',
  hour: 'numeric',
  minute: '2-digit',
});
function clock(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return clockFormat.format(date);
}

export function PatientThread({
  messages,
  appointments,
}: {
  messages: PatientMessage[];
  appointments: Appointment[];
}) {
  const people = appointments.filter((appointment) => appointment.status === 'scheduled');
  const initial =
    people.find((appointment) => appointment.attendance !== 'confirmed')?.id ?? people[0]?.id ?? '';
  const [selected, setSelected] = useState(initial);
  const active = people.find((appointment) => appointment.id === selected) ?? people[0];
  const thread = messages
    .filter((message) => message.appointmentId === active?.id)
    .slice()
    .sort((a, b) => a.at.localeCompare(b.at));

  return (
    <section className="patient-panel" aria-label="Simulated patient channel">
      <header className="patient-panel-head">
        <div>
          <span className="eyebrow">SIMULATED CHANNEL</span>
          <h2>Patient messages</h2>
        </div>
        <p>Spanish messages inside this demo. No WhatsApp API.</p>
      </header>
      {people.length ? (
        <div className="patient-switch" role="group" aria-label="Choose a patient">
          {people.map((appointment) => (
            <button
              key={appointment.id}
              type="button"
              aria-pressed={appointment.id === active?.id}
              onClick={() => setSelected(appointment.id)}
            >
              {appointment.patient.replace(' (demo)', '')}
            </button>
          ))}
        </div>
      ) : null}
      {active ? (
        <div className="thread-head">
          <span className="thread-avatar" aria-hidden="true">
            {active.patient.slice(0, 1)}
          </span>
          <div>
            <strong>{active.patient.replace(' (demo)', '')}</strong>
            <span className={`attend attend-${active.attendance}`}>
              {attendanceLabel[active.attendance]}
            </span>
          </div>
        </div>
      ) : null}
      <div className="thread" lang="es">
        {thread.length ? (
          thread.map((message) => (
            <article key={message.id} className={`bubble ${message.direction}`}>
              <p>{message.body}</p>
              <time dateTime={message.at}>{clock(message.at)}</time>
            </article>
          ))
        ) : (
          <p className="thread-empty" lang="en">
            No messages with this patient yet. A confirmed follow-up appears here in Spanish.
          </p>
        )}
      </div>
    </section>
  );
}
