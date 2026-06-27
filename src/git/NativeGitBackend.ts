import * as vscode from "vscode";

import { DiffService } from "./DiffService";
import type {
  BranchRef,
  ComparisonInput,
  ComparisonSummary,
  GitBackend,
  Repository,
} from "./GitBackend";
import { GitRunner } from "./GitRunner";

interface GitRef {
  name?: string;
  type: number;
}

interface NativeRepository {
  rootUri: vscode.Uri;
  state: {
    HEAD?: GitRef;
    refs: GitRef[];
  };
}

interface GitApi {
  repositories: NativeRepository[];
}

interface GitExtension {
  getAPI(version: 1): GitApi;
}

const localRefType = 0;
const remoteRefType = 1;
const defaultBaseCandidates = [
  "main",
  "master",
  "origin/main",
  "origin/master",
];

export class NativeGitBackend implements GitBackend {
  private readonly gitRunner = new GitRunner();
  private readonly diffService = new DiffService(this.gitRunner);

  public async getRepositories(): Promise<Repository[]> {
    return (await this.getApi()).repositories.map(({ rootUri }) => ({
      rootUri,
    }));
  }

  public async chooseRepository(
    repositories: Repository[],
  ): Promise<Repository | undefined> {
    if (repositories.length === 0) {
      return undefined;
    }

    const activeUri = vscode.window.activeTextEditor?.document.uri;
    if (activeUri) {
      const matching = repositories
        .filter(({ rootUri }) => isWithin(activeUri, rootUri))
        .sort(
          (left, right) => right.rootUri.path.length - left.rootUri.path.length,
        );
      if (matching[0]) {
        return matching[0];
      }
    }

    if (repositories.length === 1) {
      return repositories[0];
    }

    const selected = await vscode.window.showQuickPick(
      repositories.map((repository) => ({
        label: vscode.workspace.asRelativePath(repository.rootUri, false),
        description: repository.rootUri.fsPath,
        repository,
      })),
      { placeHolder: "Select a repository to review" },
    );

    return selected?.repository;
  }

  public async getCurrentBranch(repository: Repository): Promise<BranchRef> {
    const head = (await this.findRepository(repository)).state.HEAD;
    if (!head?.name || head.type !== localRefType) {
      throw new Error("The selected repository is not on a local branch.");
    }

    return { name: head.name, kind: "local", current: true };
  }

  public async getBranches(repository: Repository): Promise<BranchRef[]> {
    const nativeRepository = await this.findRepository(repository);
    const currentName = nativeRepository.state.HEAD?.name;
    const branches = new Map<string, BranchRef>();

    for (const ref of nativeRepository.state.refs) {
      if (
        !ref.name ||
        (ref.type !== localRefType && ref.type !== remoteRefType)
      ) {
        continue;
      }

      branches.set(ref.name, {
        name: ref.name,
        kind: ref.type === localRefType ? "local" : "remote",
        current: ref.type === localRefType && ref.name === currentName,
      });
    }

    for (const branch of await this.getCliBranches(repository, currentName)) {
      const existing = branches.get(branch.name);
      if (!existing) {
        branches.set(branch.name, branch);
        continue;
      }

      if (branch.current && !existing.current) {
        branches.set(branch.name, { ...existing, current: true });
      }
    }

    return Array.from(branches.values()).sort(compareBranches);
  }

  public async getDefaultBase(branches: BranchRef[]): Promise<BranchRef> {
    const configured = vscode.workspace
      .getConfiguration("branchDiffReview")
      .get<string>("defaultBaseBranch")
      ?.trim();
    const candidates = configured
      ? [configured, ...defaultBaseCandidates]
      : defaultBaseCandidates;

    for (const name of candidates) {
      const branch = branches.find((candidate) => candidate.name === name);
      if (branch) {
        return branch;
      }
    }

    throw new Error(
      "No default base branch was found. Configure branchDiffReview.defaultBaseBranch.",
    );
  }

  public async getComparisonSummary(
    input: ComparisonInput,
  ): Promise<ComparisonSummary> {
    return this.diffService.getComparisonSummary(input);
  }

  private async getApi(): Promise<GitApi> {
    const extension =
      vscode.extensions.getExtension<GitExtension>("vscode.git");
    if (!extension) {
      throw new Error("VS Code's built-in Git extension is unavailable.");
    }

    const gitExtension = extension.isActive
      ? extension.exports
      : await extension.activate();
    return gitExtension.getAPI(1);
  }

  private async findRepository(
    repository: Repository,
  ): Promise<NativeRepository> {
    const found = (await this.getApi()).repositories.find(
      ({ rootUri }) => rootUri.toString() === repository.rootUri.toString(),
    );
    if (!found) {
      throw new Error(
        `Git repository is no longer available: ${repository.rootUri.fsPath}`,
      );
    }

    return found;
  }

  private async getCliBranches(
    repository: Repository,
    currentName: string | undefined,
  ): Promise<BranchRef[]> {
    try {
      const { stdout } = await this.gitRunner.run(repository.rootUri.fsPath, [
        "for-each-ref",
        "--format=%(refname:short)\t%(refname)",
        "refs/heads",
        "refs/remotes",
      ]);

      return stdout.split("\n").flatMap((line): BranchRef[] => {
        const trimmed = line.trim();
        if (!trimmed) {
          return [];
        }

        const [name, fullName] = trimmed.split("\t");
        if (!name || !fullName) {
          return [];
        }

        if (fullName.startsWith("refs/heads/")) {
          return [{ name, kind: "local", current: name === currentName }];
        }

        if (fullName.startsWith("refs/remotes/")) {
          return [{ name, kind: "remote", current: false }];
        }

        return [];
      });
    } catch {
      return [];
    }
  }
}

function isWithin(uri: vscode.Uri, rootUri: vscode.Uri): boolean {
  if (uri.scheme !== rootUri.scheme || uri.authority !== rootUri.authority) {
    return false;
  }

  const rootPath = rootUri.path.endsWith("/")
    ? rootUri.path
    : `${rootUri.path}/`;
  return uri.path === rootUri.path || uri.path.startsWith(rootPath);
}

function compareBranches(left: BranchRef, right: BranchRef): number {
  if (left.kind !== right.kind) {
    return left.kind === "local" ? -1 : 1;
  }
  return left.name.localeCompare(right.name);
}
