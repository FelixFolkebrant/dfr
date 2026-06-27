import * as vscode from "vscode";

import { showBranchDiffPanel } from "./panel";
import { BranchDiffSidebarProvider } from "./sidebar";

export function activate(context: vscode.ExtensionContext): void {
  const sidebarProvider = new BranchDiffSidebarProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      BranchDiffSidebarProvider.viewId,
      sidebarProvider,
    ),
    vscode.commands.registerCommand("branchDiffReview.open", () => {
      showBranchDiffPanel(context);
    }),
  );
}
