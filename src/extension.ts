import * as vscode from "vscode";
import { getRepositoryContext } from "./git/getRepositoryContext";
import { NativeGitBackend } from "./git/NativeGitBackend";
import { NativeDiffView } from "./panel";
import { BranchDiffView } from "./view";

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
  const branchDiffView = new BranchDiffView(gitBackend, (state) =>
    diffView.update(state),
  );

  context.subscriptions.push(
    diffView,
    branchDiffView,
    vscode.commands.registerCommand("branchDiffReview.open", async () => {
      try {
        const repositoryContext = await getRepositoryContext(gitBackend);
        if (!repositoryContext) {
          return;
        }

        await branchDiffView.startReview(repositoryContext);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await vscode.window.showErrorMessage(
          `Branch Diff Review could not start: ${message}`,
        );
      }
    }),
    vscode.commands.registerCommand(
      "branchDiffReview.selectFile",
      (comparisonId: string, path: string) =>
        branchDiffView.selectFile(comparisonId, path),
    ),
    vscode.commands.registerCommand("branchDiffReview.selectBase", () =>
      branchDiffView.selectBase(),
    ),
    vscode.commands.registerCommand("branchDiffReview.selectCompare", () =>
      branchDiffView.selectCompare(),
    ),
  );
}
