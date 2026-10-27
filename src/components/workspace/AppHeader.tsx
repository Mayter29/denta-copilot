import { DentaryBrand } from '../brand/DentaryBrand';

export function AppHeader({ modelReady }: { modelReady: boolean }) {
  return (
    <header className="desk-header">
      <DentaryBrand placement="header" />
      <p className="desk-kicker">
        <span>Denta</span>
        Reception copilot · fictional clinic
      </p>
      <div className="desk-status">
        <span className="demo-badge">DEMO</span>
        <span className={modelReady ? 'meta-pill is-ready' : 'meta-pill'}>
          <span className="status-dot" />
          {modelReady ? 'Meta connected' : 'Meta key needed'}
        </span>
      </div>
    </header>
  );
}
