export default function Loading() {
  return <main className="staff-loading" aria-busy="true" role="status">
    <header className="staff-loading-header">
      <p className="staff-loading-kicker">Staff portal</p>
      <h1>Loading workspace</h1>
      <p>Preparing the next staff view…</p>
    </header>
    <section aria-label="Loading content" className="staff-loading-panel">
      <span className="staff-loading-line staff-loading-line-wide" />
      <span className="staff-loading-line" />
      <span className="staff-loading-line staff-loading-line-short" />
    </section>
  </main>;
}
