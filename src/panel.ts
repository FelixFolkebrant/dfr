import * as vscode from "vscode";

import {
  getLocalResourceRoots,
  getPanelColumn,
  renderWebviewDocument,
} from "./webview";

export class BranchDiffPanel {
  public static readonly viewType = "branchDiffReview.panel";

  private static currentPanel: BranchDiffPanel | undefined;

  public static show(context: vscode.ExtensionContext): void {
    if (BranchDiffPanel.currentPanel) {
      BranchDiffPanel.currentPanel.panel.reveal(getPanelColumn(), true);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      BranchDiffPanel.viewType,
      "Branch Diff Review",
      getPanelColumn(),
      {
        enableScripts: true,
        localResourceRoots: getLocalResourceRoots(context.extensionUri),
      },
    );

    BranchDiffPanel.currentPanel = new BranchDiffPanel(panel, context);
  }

  private readonly panel: vscode.WebviewPanel;
  private readonly context: vscode.ExtensionContext;
  private readonly disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    context: vscode.ExtensionContext,
  ) {
    this.panel = panel;
    this.context = context;
    this.panel.webview.html = renderWebviewDocument(
      this.panel.webview,
      this.context.extensionUri,
      "diff-panel",
    );

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  public dispose(): void {
    BranchDiffPanel.currentPanel = undefined;

    while (this.disposables.length > 0) {
      this.disposables.pop()?.dispose();
    }
  }
}
