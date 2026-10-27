import { CalendarDays, MessageSquare, MessagesSquare, BookOpen, History } from 'lucide-react';
import { DentaryBrand } from '../brand/DentaryBrand';

export type DeskPanel = 'overview' | 'schedule' | 'patients' | 'sources' | 'activity';

const items: { id: DeskPanel; label: string; icon: typeof MessageSquare; hint?: string }[] = [
  { id: 'overview', label: 'Denta', icon: MessageSquare, hint: 'AI' },
  { id: 'schedule', label: 'Schedule', icon: CalendarDays },
  { id: 'patients', label: 'Patients', icon: MessagesSquare },
  { id: 'sources', label: 'Sources', icon: BookOpen },
  { id: 'activity', label: 'Activity', icon: History },
];

export function WorkspaceSidebar({
  panel,
  followUps,
  onOpen,
}: {
  panel: DeskPanel;
  followUps: number;
  onOpen: (panel: DeskPanel) => void;
}) {
  return (
    <nav className="sidebar" aria-label="Reception desk">
      <DentaryBrand placement="sidebar" />
      <div className="workspace-switch">
        <div className="clinic-avatar" aria-hidden="true">
          B
        </div>
        <div>
          <strong>Brisa Dental</strong>
          <span>Fictional clinic</span>
        </div>
      </div>
      <span className="nav-label">DESK</span>
      {items.map(({ id, label, icon: Icon, hint }) => (
        <button
          key={id}
          type="button"
          className={`nav-item${panel === id ? ' active' : ''}`}
          aria-current={panel === id ? 'page' : undefined}
          onClick={() => onOpen(id)}
        >
          <Icon size={18} aria-hidden="true" />
          {label}
          {id === 'patients' && followUps > 0 ? (
            <span className="tiny-badge">{followUps} due</span>
          ) : hint ? (
            <span className="tiny-badge">{hint}</span>
          ) : null}
        </button>
      ))}
      <div className="sidebar-bottom">
        <div className="build-card">
          <strong>You confirm every step.</strong>
          <p>Denta drafts it. Nothing is booked or sent until you click.</p>
          <span>Meta Hackathon 2026</span>
        </div>
        <div className="user-profile">
          <div className="user-avatar" aria-hidden="true">
            S
          </div>
          <div>
            <strong>Front desk</strong>
            <span>Local session · fictional data</span>
          </div>
        </div>
      </div>
    </nav>
  );
}
