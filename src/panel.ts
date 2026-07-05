import * as vscode from "vscode";

export const nativeDiffScheme = "branch-diff-review";

interface NativeDiffSelection {
  comparisonId: string;
  baseRef: string;
  headRef: string;
  path: string;
  oldPath?: string;
}

export type NativeDiffState =
  | { status: "noSelection"; baseRef: string; headRef: string }
  | ({ status: "loading" } & NativeDiffSelection)
  | ({
      status: "ready";
      baseContent: string;
      headContent: string;
    } & NativeDiffSelection)
  | ({ status: "binary" } & NativeDiffSelection)
  | ({ status: "error"; message: string } & NativeDiffSelection);

export class NativeDiffView implements vscode.TextDocumentContentProvider {
  private readonly contents = new Map<string, string>();
  private readonly disposables: vscode.Disposable[];
  private readonly statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
  );
  private documentSequence = 0;

  public constructor() {
    this.disposables = [
      vscode.workspace.registerTextDocumentContentProvider(
        nativeDiffScheme,
        this,
      ),
      this.statusBar,
    ];
  }

  public provideTextDocumentContent(uri: vscode.Uri): string {
    return this.contents.get(uri.toString()) ?? "";
  }

  public async update(state: NativeDiffState): Promise<void> {
    if (state.status === "loading") {
      this.statusBar.text = `$(sync~spin) Loading diff for ${state.path}…`;
      this.statusBar.show();
      return;
    }

    this.statusBar.hide();

    if (state.status === "noSelection") {
      await this.closeOpenDiffs();
      this.contents.clear();
      return;
    }

    if (state.status === "binary") {
      await vscode.window.showWarningMessage(
        `DFR cannot open the binary file ${state.path} as text.`,
      );
      return;
    }

    if (state.status === "error") {
      await vscode.window.showErrorMessage(
        `DFR could not open ${state.path}: ${state.message}`,
      );
      return;
    }

    await this.openDiff(state);
  }

  public dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.contents.clear();
  }

  private async openDiff(
    state: Extract<NativeDiffState, { status: "ready" }>,
  ): Promise<void> {
    const sequence = ++this.documentSequence;
    const baseUri = this.documentUri(
      "base",
      state.oldPath ?? state.path,
      sequence,
    );
    const headUri = this.documentUri("head", state.path, sequence);
    this.contents.set(baseUri.toString(), state.baseContent);
    this.contents.set(headUri.toString(), state.headContent);

    try {
      await vscode.commands.executeCommand(
        "vscode.diff",
        baseUri,
        headUri,
        `${state.path} (${state.headRef} into ${state.baseRef})`,
        { preview: true },
      );
    } finally {
      this.contents.delete(baseUri.toString());
      this.contents.delete(headUri.toString());
    }
  }

  private documentUri(
    side: string,
    path: string,
    sequence: number,
  ): vscode.Uri {
    return vscode.Uri.from({
      scheme: nativeDiffScheme,
      path: `/${side}/${path}`,
      query: `selection=${sequence}`,
    });
  }

  private async closeOpenDiffs(): Promise<void> {
    const tabs = vscode.window.tabGroups.all.flatMap((group) =>
      group.tabs.filter((tab) => {
        if (!(tab.input instanceof vscode.TabInputTextDiff)) {
          return false;
        }
        return (
          tab.input.original.scheme === nativeDiffScheme ||
          tab.input.modified.scheme === nativeDiffScheme
        );
      }),
    );
    if (tabs.length > 0) {
      await vscode.window.tabGroups.close(tabs);
    }
  }
}
