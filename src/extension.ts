import * as vscode from "vscode";
import type { Repository } from "./git/GitBackend";
import { getRepositoryContext } from "./git/getRepositoryContext";
import { NativeGitBackend } from "./git/NativeGitBackend";
import { NativeDiffView } from "./panel";
import { BranchDiffSidebarProvider } from "./sidebar";
import type { SidebarAction } from "./webviews/protocol";

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
  let nestedRepositories = new Map<string, Repository>();
  const sidebarProvider = new BranchDiffSidebarProvider(
    context.extensionUri,
    gitBackend,
    (state) => diffView.update(state),
    async (path) =>
      await vscode.window.withProgress(
        { location: { viewId: BranchDiffSidebarProvider.viewId } },
        async () => {
          const repository = nestedRepositories.get(path);
          if (!repository) return;
          try {
            await gitBackend.openRepository(repository);
            const repositoryContext = await getRepositoryContext(
              gitBackend,
              repository,
            );
            if (!repositoryContext) return;
            await sidebarProvider.startReview(repositoryContext);
          } catch (error) {
            const message =
              error instanceof Error ? error.message : String(error);
            await vscode.window.showErrorMessage(
              `DFR could not open repository: ${message}`,
            );
          }
        },
      ),
  );

  const discover = (action: "start" | "refresh") =>
    vscode.window.withProgress(
      { location: { viewId: BranchDiffSidebarProvider.viewId } },
      async () => {
        try {
          const repositories = await gitBackend.getRepositories();
          const folders = vscode.workspace.workspaceFolders ?? [];
          const parentRepositories = repositories.filter(({ rootUri }) =>
            folders.some(
              ({ uri }) =>
                uri.scheme === rootUri.scheme &&
                uri.authority === rootUri.authority &&
                (uri.path === rootUri.path ||
                  uri.path.startsWith(`${rootUri.path.replace(/\/$/, "")}/`)),
            ),
          );
          if (parentRepositories.length === 0) {
            for (const folder of folders) {
              const entries = await vscode.workspace.fs.readDirectory(
                folder.uri,
              );
              if (
                entries.some(([name]) => name === ".git") &&
                (await gitBackend.isRepositoryRoot(folder.uri))
              ) {
                const repository = { rootUri: folder.uri };
                await gitBackend.openRepository(repository);
                parentRepositories.push(repository);
              }
            }
          }
          if (parentRepositories.length === 0) {
            const nested = await gitBackend.findNestedRepositories();
            nestedRepositories = new Map(
              nested.map((repository) => [
                vscode.workspace.asRelativePath(
                  repository.rootUri,
                  folders.length > 1,
                ),
                repository,
              ]),
            );
            await sidebarProvider.showNoRepository([
              ...nestedRepositories.keys(),
            ]);
            return;
          }
          const repository =
            await gitBackend.chooseRepository(parentRepositories);
          if (!repository) return;
          const repositoryContext = await getRepositoryContext(
            gitBackend,
            repository,
          );
          if (!repositoryContext) return;
          if (action === "start")
            await sidebarProvider.startReview(repositoryContext);
          else await sidebarProvider.refreshReview(repositoryContext);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          await vscode.window.showErrorMessage(
            `DFR could not ${action}: ${message}`,
          );
        }
      },
    );

  context.subscriptions.push(
    ...(
      [
        "previousCommit",
        "nextCommit",
        "toggleHistory",
        "copyHash",
        "toggleSettings",
      ] satisfies SidebarAction[]
    ).map((action) =>
      vscode.commands.registerCommand(`branchDiffReview.${action}`, () =>
        sidebarProvider.runAction(action),
      ),
    ),
    vscode.commands.registerCommand("branchDiffReview.closeHistory", () =>
      sidebarProvider.runAction("toggleHistory"),
    ),
    vscode.commands.registerCommand("branchDiffReview.closeSettings", () =>
      sidebarProvider.runAction("toggleSettings"),
    ),
    diffView,
    vscode.window.registerWebviewViewProvider(
      BranchDiffSidebarProvider.viewId,
      sidebarProvider,
      { webviewOptions: { retainContextWhenHidden: true } },
    ),
    vscode.commands.registerCommand(refreshCommand, () => discover("refresh")),
  );

  void discover("start");
}
