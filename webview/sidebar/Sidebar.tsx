import { useEffect, useState } from "react";
import type {
  ExtensionToSidebarMessage,
  SidebarState,
  SidebarToExtensionMessage,
} from "../../src/webviews/protocol";
import { BranchComparison } from "./components/BranchComparison";
import { ChangedFilesSection } from "./components/ChangedFilesSection";
import { ComparisonStatus } from "./components/ComparisonStatus";

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
    return <SidebarEmptyState />;
  }

  return (
    <main className="sidebar">
      <header className="sidebar-header">
        <div>
          <p className="eyebrow">Merge-base comparison</p>
          <h1>Branch changes</h1>
        </div>
      </header>
      <BranchComparison
        baseRef={state.baseRef}
        branches={state.branches}
        currentBranchName={
          state.branches.find((branch) => branch.current)?.name
        }
        headRef={state.headRef}
        onChange={(baseRef, headRef) =>
          vscode.postMessage({ type: "selectBranches", baseRef, headRef })
        }
      />
      <ComparisonStatus state={state} />
      <ChangedFilesSection
        onSelect={(comparisonId, path) =>
          vscode.postMessage({ type: "selectFile", comparisonId, path })
        }
        state={state}
      />
    </main>
  );
}

function SidebarEmptyState() {
  return (
    <main className="sidebar">
      <section className="empty-state" aria-live="polite">
        <h1>Branch changes</h1>
        <p className="muted">
          Run <strong>Open Branch Diff Review</strong> to compare branches.
        </p>
      </section>
    </main>
  );
}
