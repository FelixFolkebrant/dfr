import * as vscode from "vscode";

import { getLocalResourceRoots, renderWebviewDocument } from "./webview";

let currentPanel: vscode.WebviewPanel | undefined;

export function showBranchDiffPanel(context: vscode.ExtensionContext): void {
  if (currentPanel) {
    currentPanel.reveal(vscode.ViewColumn.Active, true);
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    "branchDiffReview.panel",
    "Branch Diff Review",
    vscode.ViewColumn.Active,
    {
      enableScripts: true,
      localResourceRoots: getLocalResourceRoots(context.extensionUri),
    },
  );

  panel.webview.html = renderWebviewDocument(
    panel.webview,
    context.extensionUri,
    "diff-panel",
  );
  currentPanel = panel;
  panel.onDidDispose(() => {
    currentPanel = undefined;
  });
}
