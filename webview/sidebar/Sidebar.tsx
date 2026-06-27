import { useEffect, useState } from "react";
import type { BranchRef } from "../../src/git/GitBackend";
import type {
  ExtensionToSidebarMessage,
  SidebarState,
  SidebarToExtensionMessage,
} from "../../src/webviews/protocol";
import { ChangedFileTree } from "./ChangedFileTree";

interface VsCodeApi {
  postMessage(message: SidebarToExtensionMessage): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

const vscode = acquireVsCodeApi();

export function Sidebar() {
  const [state, setState] = useState<SidebarState>({ status: "idle" });

  useEffect(() => {
    const receiveMessage = (event: MessageEvent<ExtensionToSidebarMessage>) => {
      if (event.data.type === "state") {
        setState(event.data.state);
      }
    };
    window.addEventListener("message", receiveMessage);
    vscode.postMessage({ type: "ready" });
    return () => window.removeEventListener("message", receiveMessage);
  }, []);

  if (state.status === "idle") {
    return (
      <main className="grid gap-3 p-3.5">
        <section className="panel" aria-live="polite">
          <h1 className="mb-2 text-lg font-semibold">Branch Diff</h1>
          <p className="muted">
            Run <strong>Open Branch Diff Review</strong> to compare branches.
          </p>
        </section>
      </main>
    );
  }

  const selectBranches = (baseRef: string, headRef: string) => {
    vscode.postMessage({ type: "selectBranches", baseRef, headRef });
  };
  const currentBranchName = state.branches.find(
    (branch) => branch.current,
  )?.name;

  return (
    <main className="grid gap-3 p-3.5">
      <header className="panel">
        <p className="eyebrow">Merge-base comparison</p>
        <h1 className="text-lg font-semibold">Branch Diff</h1>
      </header>

      <section className="panel grid gap-2.5">
        <BranchSelect
          branches={state.branches}
          currentBranchName={currentBranchName}
          label="Base"
          onChange={(baseRef) => selectBranches(baseRef, state.headRef)}
          value={state.baseRef}
        />
        <BranchSelect
          branches={state.branches}
          currentBranchName={currentBranchName}
          label="Compare"
          onChange={(headRef) => selectBranches(state.baseRef, headRef)}
          value={state.headRef}
        />
      </section>

      <section className="panel grid gap-2.5" aria-live="polite">
        <strong>Summary</strong>
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
        {state.status === "ready" && (
          <Summary totals={state.comparison.totals} />
        )}
      </section>

      <section className="panel grid gap-2.5">
        <strong>Changed files</strong>
        {state.status === "ready" && state.comparison.files.length === 0 && (
          <p className="muted">No files changed in this comparison.</p>
        )}
        {state.status === "ready" && state.comparison.files.length > 0 && (
          <ChangedFileTree
            key={state.comparison.id}
            files={state.comparison.files}
            onSelect={(path) =>
              vscode.postMessage({
                type: "selectFile",
                comparisonId: state.comparison.id,
                path,
              })
            }
            selectedPath={state.selectedPath}
          />
        )}
        {state.status !== "ready" && (
          <p className="muted">Changed files appear after the comparison.</p>
        )}
      </section>
    </main>
  );
}

interface BranchSelectProps {
  branches: BranchRef[];
  currentBranchName?: string;
  label: string;
  onChange(value: string): void;
  value: string;
}

function BranchSelect({
  branches,
  currentBranchName,
  label,
  onChange,
  value,
}: BranchSelectProps) {
  const id = `${label.toLowerCase()}-branch`;
  return (
    <div className="grid gap-1.5">
      <label className="text-xs font-semibold" htmlFor={id}>
        {label}
      </label>
      <select
        className="select"
        id={id}
        onChange={(event) => onChange(event.currentTarget.value)}
        value={value}
      >
        {branches.map((branch) => (
          <option key={branch.name} value={branch.name}>
            {branch.name === currentBranchName ? "• " : ""}
            {branch.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function Summary({
  totals,
}: {
  totals: { files: number; additions: number; deletions: number };
}) {
  return (
    <dl className="summary-grid">
      <div>
        <dt>Files</dt>
        <dd>{totals.files}</dd>
      </div>
      <div>
        <dt>Additions</dt>
        <dd className="additions">+{totals.additions}</dd>
      </div>
      <div>
        <dt>Deletions</dt>
        <dd className="deletions">-{totals.deletions}</dd>
      </div>
    </dl>
  );
}
