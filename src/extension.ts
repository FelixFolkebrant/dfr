import * as vscode from "vscode";

import { BranchDiffPanel } from "./panel";
import { BranchDiffSidebarProvider } from "./sidebar";

export function activate(context: vscode.ExtensionContext): void {
  const sidebarProvider = new BranchDiffSidebarProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      BranchDiffSidebarProvider.viewId,
      sidebarProvider,
    ),
    vscode.commands.registerCommand("branchDiffReview.open", () => {
      BranchDiffPanel.show(context);
    }),
  );
}

export function deactivate(): void {}
