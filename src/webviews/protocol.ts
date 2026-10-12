import type {
  BranchRef,
  ComparisonSummary,
  DiffFileSummary,
  MergedBranch,
  ReviewDetails,
} from "../git/GitBackend";

export interface SidebarComparison {
  id: string;
  baseRef: string;
  headRef: string;
  mergeBase: string;
  diffBaseRef: string;
  diffHeadRef: string;
  files: DiffFileSummary[];
  repositoryFiles: string[];
  totals: ComparisonSummary["totals"];
}

interface SidebarSelection {
  branches: BranchRef[];
  baseRef: string;
  headRef: string;
  review: ReviewDetails | undefined;
  selectedCommitSha: string | undefined;
  mergedBranches: MergedBranch[];
  selectedHistorySha: string | undefined;
}

export type SidebarState =
  | { status: "idle" }
  | ({ status: "loading" } & SidebarSelection)
  | ({
      status: "ready";
      comparison: SidebarComparison;
      selectedPath?: string;
    } & SidebarSelection)
  | ({ status: "error"; message: string } & SidebarSelection);

export type SidebarAction =
  | "previousCommit"
  | "nextCommit"
  | "toggleHistory"
  | "copyHash"
  | "toggleSettings";

export type ExtensionToSidebarMessage =
  | { type: "state"; state: SidebarState }
  | { type: "action"; action: "toggleHistory" | "toggleSettings" };

export type SidebarToExtensionMessage =
  | { type: "ready" }
  | { type: "toolbarState"; historyOpen: boolean; settingsOpen: boolean }
  | { type: "selectBranches"; baseRef: string; headRef: string }
  | { type: "selectCommit"; sha?: string }
  | { type: "selectHistory"; mergeSha?: string }
  | { type: "selectFile"; comparisonId: string; path: string };

export function isSidebarMessage(
  message: unknown,
): message is SidebarToExtensionMessage {
  if (!message || typeof message !== "object" || !("type" in message)) {
    return false;
  }

  if (message.type === "ready") {
    return true;
  }
  if (message.type === "toolbarState") {
    return (
      "historyOpen" in message &&
      typeof message.historyOpen === "boolean" &&
      "settingsOpen" in message &&
      typeof message.settingsOpen === "boolean"
    );
  }
  if (message.type === "selectFile") {
    return (
      "comparisonId" in message &&
      typeof message.comparisonId === "string" &&
      "path" in message &&
      typeof message.path === "string"
    );
  }
  if (message.type === "selectCommit") {
    return !("sha" in message) || typeof message.sha === "string";
  }
  if (message.type === "selectHistory") {
    return !("mergeSha" in message) || typeof message.mergeSha === "string";
  }
  return (
    message.type === "selectBranches" &&
    "baseRef" in message &&
    typeof message.baseRef === "string" &&
    "headRef" in message &&
    typeof message.headRef === "string"
  );
}
