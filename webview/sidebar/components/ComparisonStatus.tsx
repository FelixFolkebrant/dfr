import type { SidebarState } from "../../../src/webviews/protocol";

type ActiveSidebarState = Exclude<SidebarState, { status: "idle" }>;

export function ComparisonStatus({ state }: { state: ActiveSidebarState }) {
  return (
    <section className="min-h-5" aria-live="polite">
      {state.status === "loading" && (
        <p
          className="px-[3px] py-[7px] leading-[1.45] text-[var(--vscode-descriptionForeground)]"
          role="status"
        >
          Comparing {state.headRef} with {state.baseRef}…
        </p>
      )}
      {state.status === "error" && (
        <p
          className="px-[3px] py-[7px] leading-[1.45] text-[var(--vscode-errorForeground)] [overflow-wrap:anywhere]"
          role="alert"
        >
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
    <dl className="flex items-baseline justify-end gap-[7px] px-[3px] text-xs [&>div]:contents [&_dd]:m-0 [&_dd]:font-semibold [&_dd]:tabular-nums">
      <div>
        <dt className="sr-only">Files changed</dt>
        <dd className="font-normal! text-[var(--vscode-sideBar-foreground)]">
          {totals.files} {totals.files === 1 ? "file" : "files"}
        </dd>
      </div>
      <div>
        <dt className="sr-only">Additions</dt>
        <dd className="text-[var(--vscode-gitDecoration-addedResourceForeground)]">
          +{totals.additions}
        </dd>
      </div>
      <div>
        <dt className="sr-only">Deletions</dt>
        <dd className="text-[var(--vscode-gitDecoration-deletedResourceForeground)]">
          -{totals.deletions}
        </dd>
      </div>
    </dl>
  );
}
