import type * as vscode from "vscode";

export type BranchKind = "local" | "remote";

export interface BranchRef {
  name: string;
  kind: BranchKind;
  current: boolean;
}

export interface Repository {
  rootUri: vscode.Uri;
}

export interface RepositoryContext {
  repository: Repository;
  currentBranch: BranchRef;
  branches: BranchRef[];
  defaultBase: BranchRef;
}

export type FileStatus =
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "unknown";

export interface ComparisonInput {
  repoRoot: string;
  baseRef: string;
  headRef: string;
}

export interface DiffFileSummary {
  path: string;
  oldPath?: string;
  status: FileStatus;
  additions?: number;
  deletions?: number;
  isBinary: boolean;
}

export interface ComparisonSummary {
  id: string;
  repoRoot: string;
  baseRef: string;
  headRef: string;
  mergeBase: string;
  files: DiffFileSummary[];
  totals: {
    files: number;
    additions: number;
    deletions: number;
  };
}

export interface FilePatchInput extends ComparisonInput {
  path: string;
  oldPath?: string;
}

export interface FilePatchResult {
  path: string;
  oldPath?: string;
  patch?: string;
  isBinary: boolean;
}

export interface GitBackend {
  getRepositories(): Promise<Repository[]>;
  chooseRepository(repositories: Repository[]): Promise<Repository | undefined>;
  getCurrentBranch(repository: Repository): Promise<BranchRef>;
  getBranches(repository: Repository): Promise<BranchRef[]>;
  getDefaultBase(branches: BranchRef[]): Promise<BranchRef>;
  getComparisonSummary(input: ComparisonInput): Promise<ComparisonSummary>;
  getFilePatch(input: FilePatchInput): Promise<FilePatchResult>;
}
