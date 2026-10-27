import { BookOpen, CalendarDays, History, MessagesSquare } from 'lucide-react';
import type { Workspace } from '@/lib/domain/types';
import { knowledge } from '@/lib/domain/knowledge';
import { AgendaPanel } from '../AgendaPanel';
import { PatientThread } from '../patient/PatientThread';
import type { DeskPanel } from '../shell/WorkspaceSidebar';

const tabs: { id: DeskPanel; label: string; icon: typeof CalendarDays }[] = [
  { id: 'overview', label: 'Desk', icon: CalendarDays },
  { id: 'schedule', label: 'Schedule', icon: CalendarDays },
  { id: 'patients', label: 'Patients', icon: MessagesSquare },
  { id: 'sources', label: 'Sources', icon: BookOpen },
  { id: 'activity', label: 'Activity', icon: History },
];

const actions: Record<string, string> = {
  book: 'Visit booked',
  cancel: 'Visit cancelled',
  reschedule: 'Visit rescheduled',
  follow_up: 'Follow-up sent',
};

export function ContextColumn({
  state,
  date,
  onDate,
  panel,
  onPanel,
}: {
  state: Workspace;
  date: string;
  onDate: (value: string) => void;
  panel: DeskPanel;
  onPanel: (panel: DeskPanel) => void;
}) {
  const showSchedule = panel === 'overview' || panel === 'schedule';
  const showPatients = panel === 'overview' || panel === 'patients';
  return (
    <aside className={`context-panel panel-${panel}`} aria-label="Clinic desk">
      <div className="context-tabs" role="group" aria-label="Desk views">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" aria-pressed={panel === id} onClick={() => onPanel(id)}>
            <Icon size={15} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
      <div className="context-body">
        {showSchedule ? <AgendaPanel state={state} date={date} onDate={onDate} /> : null}
        {showPatients ? (
          <PatientThread messages={state.patientThread} appointments={state.appointments} />
        ) : null}
        {panel === 'sources' ? (
          <div className="reference-pane">
            <div className="context-heading">
              <div>
                <span className="eyebrow">CITED MATERIAL</span>
                <h2>Clinic sources</h2>
              </div>
            </div>
            <p className="muted small">
              Fictional notes Denta can retrieve. Lexical search in this demo.
            </p>
            {knowledge.map((item) => (
              <article className="source" key={item.id}>
                <BookOpen size={17} aria-hidden="true" />
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.content}</p>
                </div>
              </article>
            ))}
          </div>
        ) : null}
        {panel === 'activity' ? (
          <div className="reference-pane">
            <div className="context-heading">
              <div>
                <span className="eyebrow">CONFIRMED BY YOU</span>
                <h2>Session activity</h2>
              </div>
            </div>
            {state.audit.length ? (
              state.audit.toReversed().map((event) => (
                <article className="source" key={event.id}>
                  <CalendarDays size={17} aria-hidden="true" />
                  <div>
                    <h3>{actions[event.action] ?? event.action}</h3>
                    <p>
                      {new Date(event.at).toLocaleString('en-US', {
                        timeZone: 'America/Costa_Rica',
                      })}
                    </p>
                    <p>Recorded by the server after confirmation.</p>
                  </div>
                </article>
              ))
            ) : (
              <p className="muted empty-inline">Confirmed changes show up here.</p>
            )}
          </div>
        ) : null}
      </div>
      <div className="demo-note">
        <span className="status-dot" />
        <p>
          <strong>Demo desk</strong>
          <br />
          Fictional people. Nothing leaves this session.
        </p>
      </div>
    </aside>
  );
}
