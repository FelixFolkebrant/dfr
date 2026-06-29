import type { SidebarState } from "../../../src/webviews/protocol";

type ActiveSidebarState = Exclude<SidebarState, { status: "idle" }>;

export function ComparisonStatus({ state }: { state: ActiveSidebarState }) {
  return (
    <section className="comparison-summary" aria-live="polite">
      {state.status === "loading" && (
        <p className="muted" role="status">
          Comparing {state.headRef} with {state.baseRef}…
        </p>
      )}
      {state.status === "error" && (
        <p className="error" role="alert">
          {state.message}
        </p>
      )}
      {state.status === "ready" && <Summary totals={state.comparison.totals} />}
    </section>
  );
}

function Summary({
  totals,
}: {
  totals: { files: number; additions: number; deletions: number };
}) {
  return (
    <dl className="summary">
      <div className="summary-files">
        <dt className="sr-only">Files changed</dt>
        <dd>
          {totals.files} {totals.files === 1 ? "file" : "files"} changed
        </dd>
      </div>
      <div>
        <dt className="sr-only">Additions</dt>
        <dd className="additions">+{totals.additions}</dd>
      </div>
      <div>
        <dt className="sr-only">Deletions</dt>
        <dd className="deletions">-{totals.deletions}</dd>
      </div>
    </dl>
  );
}
