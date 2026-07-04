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
  mergeBase?: string;
  diffBaseRef?: string;
  diffHeadRef?: string;
}

export interface ReviewCommit {
  sha: string;
  shortSha: string;
  parentSha: string;
  subject: string;
  message: string;
}

export interface ReviewDetails {
  mergeBase: string;
  commits: ReviewCommit[];
  documents: string[];
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
  diffBaseRef: string;
  diffHeadRef: string;
  files: DiffFileSummary[];
  totals: {
    files: number;
    additions: number;
    deletions: number;
  };
}

export interface FileDiffInput extends ComparisonInput {
  mergeBase: string;
  path: string;
  oldPath?: string;
  status: FileStatus;
}

export interface FileDiffResult {
  path: string;
  oldPath?: string;
  baseContent: string;
  headContent: string;
}

export interface GitBackend {
  getRepositories(): Promise<Repository[]>;
  chooseRepository(repositories: Repository[]): Promise<Repository | undefined>;
  getCurrentBranch(repository: Repository): Promise<BranchRef>;
  getBranches(repository: Repository): Promise<BranchRef[]>;
  getDefaultBase(branches: BranchRef[]): Promise<BranchRef>;
  getReviewDetails(input: ComparisonInput): Promise<ReviewDetails>;
  getComparisonSummary(input: ComparisonInput): Promise<ComparisonSummary>;
  getFileDiff(input: FileDiffInput): Promise<FileDiffResult>;
}
