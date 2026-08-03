import type {
  GitBackend,
  MergedBranch,
  RepositoryContext,
  ReviewDetails,
} from "../git/GitBackend";
import type { NativeDiffState } from "../panel";
import type { SidebarState } from "../webviews/protocol";

export class SidebarReviewController {
  private state: SidebarState = { status: "idle" };
  private repositoryContext: RepositoryContext | undefined;
  private requestSequence = 0;
  private diffRequestSequence = 0;
  private historyRequestSequence = 0;
  private mergedBranches: MergedBranch[] = [];
  private normalBaseRef: string | undefined;
  private normalHeadRef: string | undefined;

  public constructor(
    private readonly gitBackend: GitBackend,
    private readonly publish: (state: SidebarState) => void | Promise<void>,
    private readonly publishDiff: (
      state: NativeDiffState,
    ) => void | Promise<void> = () => {},
  ) {}

  public getState(): SidebarState {
    return this.state;
  }

  public async start(context: RepositoryContext): Promise<void> {
    this.repositoryContext = context;
    this.normalBaseRef = context.defaultBase.name;
    this.normalHeadRef = context.currentBranch.name;
    if (!(await this.loadHistory(context.defaultBase.name))) return;
    await this.loadComparison(
      context.defaultBase.name,
      context.currentBranch.name,
    );
  }

  public async refresh(context: RepositoryContext): Promise<void> {
    const previousBase = this.normalBaseRef;
    const branches = new Set(context.branches.map((branch) => branch.name));

    this.repositoryContext = context;
    this.normalBaseRef =
      previousBase && branches.has(previousBase)
        ? previousBase
        : context.defaultBase.name;
    this.normalHeadRef = context.currentBranch.name;
    if (!(await this.loadHistory(this.normalBaseRef))) return;
    await this.loadComparison(this.normalBaseRef, this.normalHeadRef);
  }

  public async selectBranches(baseRef: string, headRef: string): Promise<void> {
    const context = this.repositoryContext;
    if (!context) {
      return;
    }

    const names = new Set(context.branches.map((branch) => branch.name));
    if (!names.has(baseRef) || !names.has(headRef)) {
      return;
    }

    this.normalBaseRef = baseRef;
    this.normalHeadRef = headRef;
    if (!(await this.loadHistory(baseRef))) return;
    await this.loadComparison(baseRef, headRef);
  }

  public async selectHistory(mergeSha: string | undefined): Promise<void> {
    if (!mergeSha) {
      if (this.normalBaseRef && this.normalHeadRef) {
        await this.loadComparison(this.normalBaseRef, this.normalHeadRef);
      }
      return;
    }

    const branch = this.mergedBranches.find(
      (candidate) => candidate.mergeSha === mergeSha,
    );
    if (!branch) return;
    await this.loadHistoricalComparison(branch);
  }

  public async selectCommit(sha: string | undefined): Promise<void> {
    if (this.state.status === "idle" || !this.state.review) {
      return;
    }
    const commit = sha
      ? this.state.review.commits.find((candidate) => candidate.sha === sha)
      : undefined;
    if (sha && !commit) {
      return;
    }

    await this.loadScope(
      this.state.baseRef,
      this.state.headRef,
      this.state.review,
      commit?.sha,
      this.state.selectedHistorySha,
    );
  }

  public async selectFile(comparisonId: string, path: string): Promise<void> {
    if (
      this.state.status !== "ready" ||
      this.state.comparison.id !== comparisonId ||
      !this.state.comparison.files.some((file) => file.path === path) ||
      this.state.selectedPath === path
    ) {
      return;
    }

    this.state = { ...this.state, selectedPath: path };
    await this.publish(this.state);

    const context = this.repositoryContext;
    const file = this.state.comparison.files.find(
      (candidate) => candidate.path === path,
    );
    if (!context || !file) {
      return;
    }

    const request = ++this.diffRequestSequence;
    const selection = {
      comparisonId,
      baseRef: this.state.selectedCommitSha
        ? this.state.comparison.diffBaseRef
        : this.state.baseRef,
      headRef: this.state.selectedCommitSha
        ? this.state.comparison.diffHeadRef
        : this.state.headRef,
      path: file.path,
      ...(file.oldPath ? { oldPath: file.oldPath } : {}),
    };
    await this.publishDiff({ status: "loading", ...selection });

    try {
      if (request !== this.diffRequestSequence) {
        return;
      }

      if (file.isBinary) {
        await this.publishDiff({ status: "binary", ...selection });
        return;
      }

      const result = await this.gitBackend.getFileDiff({
        repoRoot: context.repository.rootUri.fsPath,
        baseRef: selection.baseRef,
        headRef: selection.headRef,
        mergeBase: this.state.comparison.mergeBase,
        diffBaseRef: this.state.comparison.diffBaseRef,
        diffHeadRef: this.state.comparison.diffHeadRef,
        path: selection.path,
        ...(selection.oldPath ? { oldPath: selection.oldPath } : {}),
        status: file.status,
      });
      if (request !== this.diffRequestSequence) {
        return;
      }

      await this.publishDiff({
        status: "ready",
        ...selection,
        baseContent: result.baseContent,
        headContent: result.headContent,
      });
    } catch (error) {
      if (request !== this.diffRequestSequence) {
        return;
      }
      await this.publishDiff({
        status: "error",
        ...selection,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async loadComparison(
    baseRef: string,
    headRef: string,
  ): Promise<void> {
    const context = this.repositoryContext;
    if (!context) {
      return;
    }

    const request = ++this.requestSequence;
    this.diffRequestSequence += 1;
    const selection = {
      branches: context.branches,
      baseRef,
      headRef,
      review: undefined,
      selectedCommitSha: undefined,
      mergedBranches: this.mergedBranches,
      selectedHistorySha: undefined,
    };
    this.state = { status: "loading", ...selection };
    await Promise.all([
      this.publish(this.state),
      this.publishDiff({ status: "noSelection", baseRef, headRef }),
    ]);

    try {
      const review = await this.loadReviewDetails({
        repoRoot: context.repository.rootUri.fsPath,
        baseRef,
        headRef,
      });
      const summary = await this.gitBackend.getComparisonSummary({
        repoRoot: context.repository.rootUri.fsPath,
        baseRef,
        headRef,
        ...(review ? { mergeBase: review.mergeBase } : {}),
      });
      const repositoryFiles = await this.loadRepositoryFiles(
        context.repository.rootUri.fsPath,
        summary.diffHeadRef ?? headRef,
        summary.files.map((file) => file.path),
      );
      if (request !== this.requestSequence) {
        return;
      }

      const resolvedReview = review ?? {
        mergeBase: summary.mergeBase,
        commits: [],
      };

      this.state = {
        status: "ready",
        ...selection,
        review: resolvedReview,
        comparison: {
          id: summary.id,
          baseRef: summary.baseRef,
          headRef: summary.headRef,
          mergeBase: summary.mergeBase,
          diffBaseRef: summary.diffBaseRef ?? summary.mergeBase,
          diffHeadRef: summary.diffHeadRef ?? summary.headRef,
          files: summary.files,
          repositoryFiles,
          totals: summary.totals,
        },
      };
    } catch (error) {
      if (request !== this.requestSequence) {
        return;
      }

      this.state = {
        status: "error",
        ...selection,
        message: error instanceof Error ? error.message : String(error),
      };
    }

    await this.publish(this.state);
  }

  private async loadHistoricalComparison(branch: MergedBranch): Promise<void> {
    const context = this.repositoryContext;
    if (!context) return;

    const request = ++this.requestSequence;
    this.diffRequestSequence += 1;
    const selection = {
      branches: context.branches,
      baseRef: branch.baseSha,
      headRef: branch.mergeSha,
      review: undefined,
      selectedCommitSha: undefined,
      mergedBranches: this.mergedBranches,
      selectedHistorySha: branch.mergeSha,
    };
    this.state = { status: "loading", ...selection };
    await Promise.all([
      this.publish(this.state),
      this.publishDiff({
        status: "noSelection",
        baseRef: branch.baseSha,
        headRef: branch.mergeSha,
      }),
    ]);

    try {
      const review = await this.gitBackend.getReviewDetails({
        repoRoot: context.repository.rootUri.fsPath,
        baseRef: branch.baseSha,
        headRef: branch.headSha,
      });
      const summary = await this.gitBackend.getComparisonSummary({
        repoRoot: context.repository.rootUri.fsPath,
        baseRef: branch.baseSha,
        headRef: branch.mergeSha,
        mergeBase: branch.baseSha,
      });
      const repositoryFiles = await this.loadRepositoryFiles(
        context.repository.rootUri.fsPath,
        branch.mergeSha,
        summary.files.map((file) => file.path),
      );
      if (request !== this.requestSequence) return;

      this.state = {
        status: "ready",
        ...selection,
        review,
        comparison: {
          id: summary.id,
          baseRef: summary.baseRef,
          headRef: summary.headRef,
          mergeBase: summary.mergeBase,
          diffBaseRef: summary.diffBaseRef,
          diffHeadRef: summary.diffHeadRef,
          files: summary.files,
          repositoryFiles,
          totals: summary.totals,
        },
      };
    } catch (error) {
      if (request !== this.requestSequence) return;
      this.state = {
        status: "error",
        ...selection,
        message: error instanceof Error ? error.message : String(error),
      };
    }
    await this.publish(this.state);
  }

  private async loadScope(
    baseRef: string,
    headRef: string,
    review: ReviewDetails,
    selectedCommitSha: string | undefined,
    selectedHistorySha: string | undefined,
  ): Promise<void> {
    const context = this.repositoryContext;
    if (!context) {
      return;
    }
    const commit = selectedCommitSha
      ? review.commits.find((candidate) => candidate.sha === selectedCommitSha)
      : undefined;
    const historicalBranch = this.mergedBranches.find(
      (branch) => branch.mergeSha === selectedHistorySha,
    );
    const scopeMergeBase = historicalBranch?.baseSha ?? review.mergeBase;
    const request = ++this.requestSequence;
    this.diffRequestSequence += 1;
    const selection = {
      branches: context.branches,
      baseRef,
      headRef,
      review,
      selectedCommitSha,
      mergedBranches: this.mergedBranches,
      selectedHistorySha,
    };
    this.state = { status: "loading", ...selection };
    await Promise.all([
      this.publish(this.state),
      this.publishDiff({ status: "noSelection", baseRef, headRef }),
    ]);

    try {
      const summary = await this.gitBackend.getComparisonSummary({
        repoRoot: context.repository.rootUri.fsPath,
        baseRef,
        headRef,
        mergeBase: scopeMergeBase,
        ...(commit
          ? { diffBaseRef: commit.parentSha, diffHeadRef: commit.sha }
          : {}),
      });
      const repositoryFiles = await this.loadRepositoryFiles(
        context.repository.rootUri.fsPath,
        summary.diffHeadRef ?? headRef,
        summary.files.map((file) => file.path),
      );
      if (request !== this.requestSequence) {
        return;
      }
      this.state = {
        status: "ready",
        ...selection,
        comparison: {
          id: summary.id,
          baseRef: summary.baseRef,
          headRef: summary.headRef,
          mergeBase: summary.mergeBase,
          diffBaseRef: summary.diffBaseRef ?? summary.mergeBase,
          diffHeadRef: summary.diffHeadRef ?? summary.headRef,
          files: summary.files,
          repositoryFiles,
          totals: summary.totals,
        },
      };
    } catch (error) {
      if (request !== this.requestSequence) {
        return;
      }
      this.state = {
        status: "error",
        ...selection,
        message: error instanceof Error ? error.message : String(error),
      };
    }
    await this.publish(this.state);
  }

  private async loadHistory(baseRef: string): Promise<boolean> {
    const context = this.repositoryContext;
    if (!context) return false;
    const request = ++this.historyRequestSequence;
    const backend = this.gitBackend as GitBackend & {
      getMergedBranches?: GitBackend["getMergedBranches"];
    };
    if (!backend.getMergedBranches) {
      this.mergedBranches = [];
      return true;
    }
    const branches =
      (await backend.getMergedBranches(
        context.repository.rootUri.fsPath,
        baseRef,
      )) ?? [];
    if (request !== this.historyRequestSequence) return false;
    this.mergedBranches = branches;
    return true;
  }

  private async loadReviewDetails(input: {
    repoRoot: string;
    baseRef: string;
    headRef: string;
  }): Promise<ReviewDetails | undefined> {
    const backend = this.gitBackend as GitBackend & {
      getReviewDetails?: GitBackend["getReviewDetails"];
    };
    return backend.getReviewDetails?.(input);
  }

  private async loadRepositoryFiles(
    repoRoot: string,
    ref: string,
    changedPaths: string[],
  ): Promise<string[]> {
    const backend = this.gitBackend as GitBackend & {
      getRepositoryFiles?: GitBackend["getRepositoryFiles"];
    };
    const paths = (await backend.getRepositoryFiles?.(repoRoot, ref)) ?? [];
    return Array.from(new Set([...paths, ...changedPaths])).sort();
  }
}
