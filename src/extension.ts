import * as vscode from "vscode";
import { getRepositoryContext } from "./git/getRepositoryContext";
import { NativeGitBackend } from "./git/NativeGitBackend";
import { showBranchDiffPanel } from "./panel";
import { BranchDiffSidebarProvider } from "./sidebar";

export function activate(context: vscode.ExtensionContext): void {
  if (
    context.extensionMode === vscode.ExtensionMode.Development &&
    !vscode.workspace.workspaceFolders?.length
  ) {
    const accepted = vscode.workspace.updateWorkspaceFolders(0, 0, {
      uri: context.extensionUri,
    });
    if (!accepted) {
      throw new Error("VS Code rejected the development workspace folder");
    }
    return;
  }

  const gitBackend = new NativeGitBackend();
  const sidebarProvider = new BranchDiffSidebarProvider(
    context.extensionUri,
    gitBackend,
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      BranchDiffSidebarProvider.viewId,
      sidebarProvider,
    ),
    vscode.commands.registerCommand("branchDiffReview.open", async () => {
      try {
        const repositoryContext = await getRepositoryContext(gitBackend);
        if (!repositoryContext) {
          return;
        }

        void sidebarProvider.startReview(repositoryContext);
        showBranchDiffPanel(context, repositoryContext);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await vscode.window.showErrorMessage(
          `Branch Diff Review could not start: ${message}`,
        );
      }
    }),
  );
}
