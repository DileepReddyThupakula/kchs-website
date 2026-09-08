export default function Loading() {
  return <main className="rollover-page" aria-busy="true">
    <div className="rollover-loading" role="status">
      <span className="academic-kicker">Academic operations</span>
      <h1>Loading rollover workspace</h1>
      <p>Reading the current academic structure and active enrollments…</p>
    </div>
  </main>;
}
