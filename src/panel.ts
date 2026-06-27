import * as vscode from "vscode";

import type { RepositoryContext } from "./git/GitBackend";
import { getLocalResourceRoots, renderWebviewDocument } from "./webview";

let currentPanel: vscode.WebviewPanel | undefined;

export function showBranchDiffPanel(
  context: vscode.ExtensionContext,
  repositoryContext: RepositoryContext,
): void {
  const title = `${repositoryContext.currentBranch.name} into ${repositoryContext.defaultBase.name}`;
  if (currentPanel) {
    currentPanel.title = title;
    currentPanel.reveal(vscode.ViewColumn.Active, true);
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    "branchDiffReview.panel",
    title,
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
