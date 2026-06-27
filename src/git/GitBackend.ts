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

export interface GitBackend {
  getRepositories(): Promise<Repository[]>;
  chooseRepository(repositories: Repository[]): Promise<Repository | undefined>;
  getCurrentBranch(repository: Repository): Promise<BranchRef>;
  getBranches(repository: Repository): Promise<BranchRef[]>;
  getDefaultBase(branches: BranchRef[]): Promise<BranchRef>;
}
