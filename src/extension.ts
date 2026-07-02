import * as vscode from "vscode";
import type { RepositoryContext } from "./git/GitBackend";
import { getRepositoryContext } from "./git/getRepositoryContext";
import { NativeGitBackend } from "./git/NativeGitBackend";
import { NativeDiffView } from "./panel";
import { BranchDiffSidebarProvider } from "./sidebar";

const openCommand = "branchDiffReview.open";
const refreshCommand = "branchDiffReview.refresh";

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
  const diffView = new NativeDiffView();
  const sidebarProvider = new BranchDiffSidebarProvider(
    context.extensionUri,
    gitBackend,
    (state) => diffView.update(state),
  );

  context.subscriptions.push(
    diffView,
    vscode.window.registerWebviewViewProvider(
      BranchDiffSidebarProvider.viewId,
      sidebarProvider,
    ),
    vscode.commands.registerCommand(openCommand, () =>
      discoverAndRun(gitBackend, "start", (repositoryContext) =>
        sidebarProvider.startReview(repositoryContext),
      ),
    ),
    vscode.commands.registerCommand(refreshCommand, () =>
      discoverAndRun(gitBackend, "refresh", (repositoryContext) =>
        sidebarProvider.refreshReview(repositoryContext),
      ),
    ),
  );
}

async function discoverAndRun(
  gitBackend: NativeGitBackend,
  action: "start" | "refresh",
  run: (repositoryContext: RepositoryContext) => Promise<void>,
): Promise<void> {
  try {
    const repositoryContext = await getRepositoryContext(gitBackend);
    if (!repositoryContext) {
      return;
    }

    await run(repositoryContext);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await vscode.window.showErrorMessage(
      `Branch Diff Review could not ${action}: ${message}`,
    );
  }
}
