import type {
  BranchRef,
  ComparisonSummary,
  DiffFileSummary,
} from "../git/GitBackend";

export interface SidebarComparison {
  id: string;
  baseRef: string;
  headRef: string;
  files: DiffFileSummary[];
  totals: ComparisonSummary["totals"];
}

interface SidebarSelection {
  branches: BranchRef[];
  baseRef: string;
  headRef: string;
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

export type ExtensionToSidebarMessage = {
  type: "state";
  state: SidebarState;
};

export type SidebarToExtensionMessage =
  | { type: "ready" }
  | { type: "selectBranches"; baseRef: string; headRef: string }
  | { type: "selectFile"; comparisonId: string; path: string };

export interface DiffPanelSelection {
  comparisonId: string;
  baseRef: string;
  headRef: string;
  path: string;
  oldPath?: string;
}

export type DiffPanelState =
  | { status: "idle" }
  | { status: "noSelection"; baseRef: string; headRef: string }
  | ({ status: "loading" } & DiffPanelSelection)
  | ({ status: "ready"; patch: string } & DiffPanelSelection)
  | ({ status: "binary" } & DiffPanelSelection)
  | ({
      status: "tooLarge";
      bytes: number;
      maxBytes: number;
    } & DiffPanelSelection)
  | ({ status: "error"; message: string } & DiffPanelSelection);

export type ExtensionToDiffPanelMessage = {
  type: "state";
  state: DiffPanelState;
};

export type DiffPanelToExtensionMessage = { type: "ready" };
