'use client';
import { useState } from 'react';
import type { Proposal } from '@/lib/domain/types';
import { AgendaPanel } from './AgendaPanel';
import { AppHeader } from './workspace/AppHeader';
import { PatientThread } from './workspace/PatientThread';
import { StaffPanel } from './workspace/StaffPanel';
import { useWorkspaceSession, type WorkspaceView } from './workspace/useWorkspaceSession';

const panels = [
  { id: 'agenda', label: 'Schedule' },
  { id: 'denta', label: 'Denta' },
  { id: 'patient', label: 'Patient' },
] as const;
type PanelId = (typeof panels)[number]['id'];

function selectedAppointmentId(state: WorkspaceView, pickedId: string | null) {
  if (pickedId && state.appointments.some((appointment) => appointment.id === pickedId))
    return pickedId;
  const needsFollowUp = state.appointments.find(
    (appointment) => appointment.status === 'scheduled' && appointment.outreach !== 'confirmed',
  );
  return needsFollowUp?.id ?? state.appointments[0]?.id ?? '';
}

export function CopilotWorkspace() {
  const session = useWorkspaceSession();
  const [panel, setPanel] = useState<PanelId>('denta');
  const [tab, setTab] = useState('agenda');
  const [pickedId, setPickedId] = useState<string | null>(null);
  const { state } = session;
  function selectPatient(id: string) {
    setPickedId(id);
    setPanel('patient');
  }
  return (
    <div className="desk">
      <AppHeader modelReady={Boolean(state?.modelReady)} />
      <PanelTabs panel={panel} onPanel={setPanel} />
      {!state ? (
        <LoadingClinic error={session.error} onRetry={() => void session.load()} />
      ) : (
        <LoadedDesk
          session={session}
          state={state}
          panel={panel}
          tab={tab}
          onTab={setTab}
          selectedId={selectedAppointmentId(state, pickedId)}
          onSelectPatient={selectPatient}
        />
      )}
    </div>
  );
}

function PanelTabs({ panel, onPanel }: { panel: PanelId; onPanel: (id: PanelId) => void }) {
  return (
    <div className="panel-tabs" role="tablist" aria-label="Workspace panels">
      {panels.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={panel === item.id}
          onClick={() => onPanel(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function LoadingClinic({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="desk-panels">
      <section className="loading-panel" aria-busy="true" aria-live="polite">
        <p>{error ? 'The demo session did not load.' : 'Loading the fictional clinic…'}</p>
        {error ? <p role="alert">{error}</p> : <div className="skeleton" />}
        {error ? (
          <button type="button" className="primary" onClick={onRetry}>
            Try again
          </button>
        ) : null}
      </section>
    </div>
  );
}

function LoadedDesk({
  session,
  state,
  panel,
  tab,
  onTab,
  selectedId,
  onSelectPatient,
}: {
  session: ReturnType<typeof useWorkspaceSession>;
  state: WorkspaceView;
  panel: PanelId;
  tab: string;
  onTab: (tab: string) => void;
  selectedId: string;
  onSelectPatient: (id: string) => void;
}) {
  function onDecide(id: string, approved: boolean) {
    void session.decide(id, approved).then((updated: Proposal | undefined) => {
      if (updated?.status === 'confirmed' && updated.change.appointmentId)
        onSelectPatient(updated.change.appointmentId);
    });
  }
  return (
    <div className="desk-panels">
      <div data-panel="agenda" className={panel === 'agenda' ? 'is-active' : ''}>
        <AgendaPanel
          state={state}
          date={session.date}
          onDate={session.setDate}
          tab={tab}
          onTab={onTab}
          selectedId={selectedId}
          onSelect={onSelectPatient}
        />
      </div>
      <div data-panel="denta" className={panel === 'denta' ? 'is-active' : ''}>
        <StaffPanel
          state={state}
          draft={session.draft}
          onDraftChange={session.setDraft}
          onSend={() => void session.send()}
          onDecide={onDecide}
          busy={session.busy}
          audioActive={session.audioActive}
          error={session.error}
          onActivityChange={session.onAudioActivity}
          textareaRef={session.textareaRef}
        />
      </div>
      <div data-panel="patient" className={panel === 'patient' ? 'is-active' : ''}>
        <PatientThread state={state} selectedId={selectedId} onSelect={onSelectPatient} />
      </div>
    </div>
  );
}
