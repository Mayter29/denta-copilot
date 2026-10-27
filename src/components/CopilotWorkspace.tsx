'use client';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { DentaryBrand } from './brand/DentaryBrand';
import { ChatComposer } from './chat/ChatComposer';
import { ContextColumn } from './desk/ContextColumn';
import { useReceptionDesk } from './desk/useReceptionDesk';
import { WorkspaceSidebar } from './shell/WorkspaceSidebar';
import { StaffConversation } from './staff/StaffConversation';

export function CopilotWorkspace() {
  const desk = useReceptionDesk();
  return (
    <div className={desk.shellClass}>
      <WorkspaceSidebar panel={desk.panel} followUps={desk.followUps} onOpen={desk.openPanel} />
      <main className="main">
        <header className="topbar">
          <DentaryBrand placement="header" />
          <div className="topbar-actions">
            <span className="demo-badge">DEMO</span>
            <button
              className="icon-button"
              type="button"
              title={desk.contextOpen ? 'Hide clinic desk' : 'Show clinic desk'}
              aria-label={desk.contextOpen ? 'Hide clinic desk' : 'Show clinic desk'}
              onClick={() => desk.setContextOpen((open) => !open)}
            >
              {desk.contextOpen ? <PanelRightClose size={19} /> : <PanelRightOpen size={19} />}
            </button>
          </div>
        </header>
        <StaffConversation
          messages={desk.state?.messages ?? []}
          proposals={desk.state?.proposals ?? []}
          busy={desk.busy}
          modelReady={!!desk.state?.modelReady}
          loaded={!!desk.state}
          onChoose={desk.choose}
          onDecide={(id, approved) => {
            void desk.onDecide(id, approved);
          }}
          endRef={desk.bottom}
        />
        <div className="composer-area">
          {desk.error ? (
            <div className="error-message" role="alert">
              {desk.error}
              {!desk.state ? (
                <button type="button" onClick={() => void desk.load()}>
                  Retry connection
                </button>
              ) : null}
            </div>
          ) : null}
          <ChatComposer
            draft={desk.draft}
            onDraftChange={desk.setDraft}
            onSend={() => {
              void desk.send();
            }}
            disabled={desk.sending || !desk.state}
            busy={desk.sending}
            onActivityChange={desk.onAudioActivity}
            textareaRef={desk.textarea}
          />
        </div>
      </main>
      {desk.contextOpen && desk.state ? (
        <ContextColumn
          state={desk.state}
          date={desk.date}
          onDate={desk.setDate}
          panel={desk.panel}
          onPanel={desk.openPanel}
        />
      ) : null}
      <nav className="mobile-nav" aria-label="Mobile desk">
        <button
          type="button"
          aria-pressed={desk.panel === 'overview'}
          onClick={() => desk.openPanel('overview')}
        >
          Denta
        </button>
        <button
          type="button"
          aria-pressed={desk.panel === 'schedule'}
          onClick={() => desk.openPanel('schedule')}
        >
          Schedule
        </button>
        <button
          type="button"
          aria-pressed={desk.panel === 'patients'}
          onClick={() => desk.openPanel('patients')}
        >
          Patients{desk.followUps ? ` (${desk.followUps})` : ''}
        </button>
      </nav>
    </div>
  );
}
