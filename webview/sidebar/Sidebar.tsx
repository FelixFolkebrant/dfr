import { useEffect, useState } from "react";
import type { DirectoryDisplay } from "../../src/webviews/fileTree";
import type {
  ExtensionToSidebarMessage,
  SidebarState,
  SidebarToExtensionMessage,
} from "../../src/webviews/protocol";
import { BranchSelect } from "./components/BranchSelect";
import { ChangedFilesSection } from "./components/ChangedFilesSection";
import { CommitNavigation } from "./components/CommitNavigation";
import { ComparisonStatus } from "./components/ComparisonStatus";
import { DetailsSections } from "./components/DetailsSections";

interface VsCodeApi {
  postMessage(message: SidebarToExtensionMessage): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

const vscode = acquireVsCodeApi();

export function Sidebar() {
  const [state, setState] = useState<SidebarState>({ status: "idle" });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [openSettingsAfterHistory, setOpenSettingsAfterHistory] =
    useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [directoryDisplay, setDirectoryDisplay] =
    useState<DirectoryDisplay>("flattened");

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

  useEffect(() => {
    if (
      openSettingsAfterHistory &&
      state.status !== "idle" &&
      !state.selectedHistorySha
    ) {
      setOpenSettingsAfterHistory(false);
      setSettingsOpen(true);
    }
  }, [openSettingsAfterHistory, state]);

  useEffect(() => {
    const receiveAction = (event: MessageEvent<ExtensionToSidebarMessage>) => {
      if (event.data.type !== "action" || state.status === "idle") return;
      if (event.data.action === "toggleHistory") {
        setHistoryOpen(!historyOpen);
        if (historyOpen && state.selectedHistorySha) {
          vscode.postMessage({ type: "selectHistory" });
        }
        setSettingsOpen(false);
        setOpenSettingsAfterHistory(false);
      } else {
        setHistoryOpen(false);
        if (state.selectedHistorySha) {
          setSettingsOpen(false);
          setOpenSettingsAfterHistory(true);
          vscode.postMessage({ type: "selectHistory" });
        } else {
          setSettingsOpen((open) => !open);
        }
      }
    };
    window.addEventListener("message", receiveAction);
    return () => window.removeEventListener("message", receiveAction);
  }, [historyOpen, state]);

  useEffect(() => {
    vscode.postMessage({ type: "toolbarState", historyOpen, settingsOpen });
  }, [historyOpen, settingsOpen]);

  if (state.status === "idle") {
    return <SidebarEmptyState />;
  }

  return (
    <main className="flex h-full min-w-0 flex-col gap-3.5 overflow-hidden bg-[var(--vscode-sideBar-background)] px-3 pt-3.5 pb-3 text-[length:var(--vscode-font-size)] text-[var(--vscode-sideBar-foreground)] [color-scheme:light_dark] [font-family:var(--vscode-font-family)]">
      <CommitNavigation
        allChangesTitle={
          state.mergedBranches.find(
            (branch) => branch.mergeSha === state.selectedHistorySha,
          )?.name ?? state.headRef
        }
        commits={state.review?.commits ?? []}
        disabled={!state.review}
        historyBranches={state.mergedBranches}
        historyDisabled={state.status === "loading"}
        historyOpen={historyOpen}
        onChange={(sha) =>
          vscode.postMessage(
            sha ? { type: "selectCommit", sha } : { type: "selectCommit" },
          )
        }
        onHistoryChange={(mergeSha) => {
          if (!mergeSha) setHistoryOpen(false);
          vscode.postMessage(
            mergeSha
              ? { type: "selectHistory", mergeSha }
              : { type: "selectHistory" },
          );
        }}
        selectedHistorySha={state.selectedHistorySha}
        selectedSha={state.selectedCommitSha}
        totals={state.status === "ready" ? state.comparison.totals : undefined}
      />
      {settingsOpen ? (
        <section
          className="flex min-w-0 flex-col gap-3.5 pt-0.5"
          aria-label="Comparison settings"
        >
          <BranchSelect
            branches={state.branches}
            currentBranchName={
              state.branches.find((branch) => branch.current)?.name
            }
            label="Review branch"
            onChange={(headRef) =>
              vscode.postMessage({
                type: "selectBranches",
                baseRef: state.baseRef,
                headRef,
              })
            }
            value={state.headRef}
          />
          <BranchSelect
            branches={state.branches}
            currentBranchName={
              state.branches.find((branch) => branch.current)?.name
            }
            label="Compare with"
            onChange={(baseRef) =>
              vscode.postMessage({
                type: "selectBranches",
                baseRef,
                headRef: state.headRef,
              })
            }
            value={state.baseRef}
          />
        </section>
      ) : (
        <Review
          directoryDisplay={directoryDisplay}
          onDirectoryDisplayChange={setDirectoryDisplay}
          state={state}
        />
      )}
    </main>
  );
}

function Review({
  directoryDisplay,
  onDirectoryDisplayChange,
  state,
}: {
  directoryDisplay: DirectoryDisplay;
  onDirectoryDisplayChange(value: DirectoryDisplay): void;
  state: Exclude<SidebarState, { status: "idle" }>;
}) {
  const selectedCommit = state.review?.commits.find(
    (commit) => commit.sha === state.selectedCommitSha,
  );
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3.5">
      {state.review && state.review.commits.length === 0 && (
        <p className="px-[3px] py-[7px] text-[11px] leading-[1.45] text-[var(--vscode-descriptionForeground)]">
          No commits were introduced by this branch.
        </p>
      )}
      <DetailsSections selectedCommit={selectedCommit} />
      <ComparisonStatus state={state} />
      <ChangedFilesSection
        directoryDisplay={directoryDisplay}
        onDirectoryDisplayChange={onDirectoryDisplayChange}
        onSelect={(comparisonId, path) =>
          vscode.postMessage({ type: "selectFile", comparisonId, path })
        }
        state={state}
      />
    </div>
  );
}

function SidebarEmptyState() {
  return (
    <main className="flex min-h-screen min-w-0 flex-col gap-3.5 bg-[var(--vscode-sideBar-background)] px-3 pt-3.5 pb-5 text-[length:var(--vscode-font-size)] text-[var(--vscode-sideBar-foreground)] [color-scheme:light_dark] [font-family:var(--vscode-font-family)]">
      <section className="grid gap-2 p-3" aria-live="polite">
        <h1 className="text-sm">Branch changes</h1>
        <p className="text-[var(--vscode-descriptionForeground)]">
          Loading branch comparison…
        </p>
      </section>
    </main>
  );
}
