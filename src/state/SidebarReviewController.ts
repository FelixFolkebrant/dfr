import type { GitBackend, RepositoryContext } from "../git/GitBackend";
import type { DiffPanelState, SidebarState } from "../webviews/protocol";

export const MAX_RENDERED_PATCH_BYTES = 1024 * 1024;

export class SidebarReviewController {
  private state: SidebarState = { status: "idle" };
  private repositoryContext: RepositoryContext | undefined;
  private requestSequence = 0;
  private patchRequestSequence = 0;

  public constructor(
    private readonly gitBackend: GitBackend,
    private readonly publish: (state: SidebarState) => void | Promise<void>,
    private readonly publishPanel: (
      state: DiffPanelState,
    ) => void | Promise<void> = () => {},
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

    const context = this.repositoryContext;
    const file = this.state.comparison.files.find(
      (candidate) => candidate.path === path,
    );
    if (!context || !file) {
      return;
    }

    const request = ++this.patchRequestSequence;
    const selection = {
      comparisonId,
      baseRef: this.state.baseRef,
      headRef: this.state.headRef,
      path: file.path,
      ...(file.oldPath ? { oldPath: file.oldPath } : {}),
    };
    await this.publishPanel({ status: "loading", ...selection });

    try {
      const result = await this.gitBackend.getFilePatch({
        repoRoot: context.repository.rootUri.fsPath,
        baseRef: selection.baseRef,
        headRef: selection.headRef,
        path: selection.path,
        ...(selection.oldPath ? { oldPath: selection.oldPath } : {}),
      });
      if (request !== this.patchRequestSequence) {
        return;
      }

      if (result.isBinary) {
        await this.publishPanel({ status: "binary", ...selection });
        return;
      }

      if (!result.patch) {
        throw new Error(`Git returned no patch for ${selection.path}`);
      }

      const bytes = Buffer.byteLength(result.patch, "utf8");
      if (bytes > MAX_RENDERED_PATCH_BYTES) {
        await this.publishPanel({
          status: "tooLarge",
          ...selection,
          bytes,
          maxBytes: MAX_RENDERED_PATCH_BYTES,
        });
        return;
      }

      await this.publishPanel({
        status: "ready",
        ...selection,
        patch: result.patch,
      });
    } catch (error) {
      if (request !== this.patchRequestSequence) {
        return;
      }
      await this.publishPanel({
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
    this.patchRequestSequence += 1;
    const selection = {
      branches: context.branches,
      baseRef,
      headRef,
    };
    this.state = { status: "loading", ...selection };
    await Promise.all([
      this.publish(this.state),
      this.publishPanel({ status: "noSelection", baseRef, headRef }),
    ]);

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
