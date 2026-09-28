export function OverviewPage(): React.JSX.Element {
  return (
    <div>
      <header className="page-header">
        <h1 className="page-header__title">Operations Overview</h1>
        <p className="page-header__subtitle">
          Remote operations dashboard for Antarctic research stations
        </p>
      </header>
      <div className="card">
        <p>Station overview will be implemented in Phase 4.</p>
        <p style={{ marginTop: 'var(--space-2)', color: 'var(--color-text-secondary)' }}>
          <span className="badge badge--operational">System Operational</span>
        </p>
      </div>
    </div>
  );
}
