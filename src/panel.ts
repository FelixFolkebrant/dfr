import * as vscode from "vscode";

import type { RepositoryContext } from "./git/GitBackend";
import { getLocalResourceRoots, renderWebviewDocument } from "./webview";
import type {
  DiffPanelState,
  DiffPanelToExtensionMessage,
  ExtensionToDiffPanelMessage,
} from "./webviews/protocol";

let currentPanel: vscode.WebviewPanel | undefined;
let currentState: DiffPanelState = { status: "idle" };

export async function updateBranchDiffPanel(
  state: DiffPanelState,
): Promise<void> {
  currentState = state;
  if (!currentPanel) {
    return;
  }

  currentPanel.title = panelTitle(state);
  const message: ExtensionToDiffPanelMessage = { type: "state", state };
  await currentPanel.webview.postMessage(message);
}

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
  panel.webview.onDidReceiveMessage((message: unknown) => {
    if (isDiffPanelMessage(message)) {
      void updateBranchDiffPanel(currentState);
    }
  });
  panel.onDidDispose(() => {
    currentPanel = undefined;
  });
}

function isDiffPanelMessage(
  message: unknown,
): message is DiffPanelToExtensionMessage {
  return Boolean(
    message &&
      typeof message === "object" &&
      "type" in message &&
      message.type === "ready",
  );
}

function panelTitle(state: DiffPanelState): string {
  if (state.status === "idle") {
    return "Branch Diff Review";
  }
  return `${state.headRef} into ${state.baseRef}`;
}
