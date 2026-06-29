import type {
  BranchRef,
  ComparisonSummary,
  DiffFileSummary,
} from "../git/GitBackend";

export interface ReviewComparison {
  id: string;
  baseRef: string;
  headRef: string;
  mergeBase: string;
  files: DiffFileSummary[];
  totals: ComparisonSummary["totals"];
}

interface ReviewSelection {
  branches: BranchRef[];
  baseRef: string;
  headRef: string;
}

export type ReviewState =
  | { status: "idle" }
  | ({ status: "loading" } & ReviewSelection)
  | ({
      status: "ready";
      comparison: ReviewComparison;
      selectedPath?: string;
    } & ReviewSelection)
  | ({ status: "error"; message: string } & ReviewSelection);
