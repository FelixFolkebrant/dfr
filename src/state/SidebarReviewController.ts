import type { GitBackend, RepositoryContext } from "../git/GitBackend";
import type { SidebarState } from "../webviews/protocol";

export class SidebarReviewController {
  private state: SidebarState = { status: "idle" };
  private repositoryContext: RepositoryContext | undefined;
  private requestSequence = 0;

  public constructor(
    private readonly gitBackend: GitBackend,
    private readonly publish: (state: SidebarState) => void | Promise<void>,
  ) {}

  public getState(): SidebarState {
    return this.state;
  }

  public async start(context: RepositoryContext): Promise<void> {
    this.repositoryContext = context;
    await this.loadComparison(
      context.defaultBase.name,
      context.currentBranch.name,
    );
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

    await this.loadComparison(baseRef, headRef);
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
    const selection = {
      branches: context.branches,
      baseRef,
      headRef,
    };
    this.state = { status: "loading", ...selection };
    await this.publish(this.state);

    try {
      const summary = await this.gitBackend.getComparisonSummary({
        repoRoot: context.repository.rootUri.fsPath,
        baseRef,
        headRef,
      });
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
          files: summary.files,
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
}
