import * as vscode from "vscode";

import type { GitBackend, RepositoryContext } from "./git/GitBackend";
import type { NativeDiffState } from "./panel";
import { SidebarReviewController } from "./state/SidebarReviewController";
import { getLocalResourceRoots, renderWebviewDocument } from "./webview";
import {
  type ExtensionToSidebarMessage,
  isSidebarMessage,
  type SidebarAction,
  type SidebarState,
} from "./webviews/protocol";

export class BranchDiffSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = "branchDiffReview.sidebar";

  private webview: vscode.Webview | undefined;
  private webviewReady = false;
  private readonly controller: SidebarReviewController;

  constructor(
    private readonly extensionUri: vscode.Uri,
    gitBackend: GitBackend,
    publishDiff: (state: NativeDiffState) => void | Promise<void>,
  ) {
    this.controller = new SidebarReviewController(
      gitBackend,
      (state) => this.publishState(state),
      publishDiff,
    );
  }

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.webview = webviewView.webview;
    this.webviewReady = false;
    void this.updateToolbarContext();
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: getLocalResourceRoots(this.extensionUri),
    };
    webviewView.webview.html = renderWebviewDocument(
      webviewView.webview,
      this.extensionUri,
      "sidebar",
    );
    const messageSubscription = webviewView.webview.onDidReceiveMessage(
      (message: unknown) => this.handleMessage(message),
    );
    webviewView.onDidDispose(() => {
      messageSubscription.dispose();
      if (this.webview === webviewView.webview) {
        this.webview = undefined;
        this.webviewReady = false;
        void this.updateToolbarContext();
        void this.setToolbarState(false, false);
      }
    });
  }

  public async startReview(context: RepositoryContext): Promise<void> {
    await this.controller.start(context);
  }

  public async refreshReview(context: RepositoryContext): Promise<void> {
    await this.controller.refresh(context);
  }

  public async runAction(action: SidebarAction): Promise<void> {
    const state = this.controller.getState();
    if (!this.webviewReady || state.status === "idle") return;

    if (action === "toggleHistory" || action === "toggleSettings") {
      await this.webview?.postMessage({
        type: "action",
        action,
      } satisfies ExtensionToSidebarMessage);
      return;
    }
    if (state.status !== "ready" || !state.review) return;

    const commits = state.review.commits;
    const index = commits.findIndex(
      (commit) => commit.sha === state.selectedCommitSha,
    );
    if (action === "copyHash") {
      if (index < 0) return;
      await vscode.env.clipboard.writeText(commits[index].sha);
      vscode.window.setStatusBarMessage("DFR: Commit hash copied", 1000);
      return;
    }
    if (!commits.length) return;
    const sha =
      action === "previousCommit"
        ? index < 0
          ? commits.at(-1)?.sha
          : commits[index - 1]?.sha
        : index < 0
          ? commits[0]?.sha
          : commits[index + 1]?.sha;
    await this.controller.selectCommit(sha);
  }

  private async updateToolbarContext(): Promise<void> {
    const state = this.controller.getState();
    const ready = this.webviewReady && state.status !== "idle";
    await Promise.all([
      vscode.commands.executeCommand(
        "setContext",
        "branchDiffReview.sidebarReady",
        ready,
      ),
      vscode.commands.executeCommand(
        "setContext",
        "branchDiffReview.canNavigate",
        ready && state.status === "ready" && !!state.review?.commits.length,
      ),
      vscode.commands.executeCommand(
        "setContext",
        "branchDiffReview.canCopyHash",
        ready && state.status === "ready" && !!state.selectedCommitSha,
      ),
    ]);
  }

  private async setToolbarState(
    historyOpen: boolean,
    settingsOpen: boolean,
  ): Promise<void> {
    await Promise.all([
      vscode.commands.executeCommand(
        "setContext",
        "branchDiffReview.historyOpen",
        historyOpen,
      ),
      vscode.commands.executeCommand(
        "setContext",
        "branchDiffReview.settingsOpen",
        settingsOpen,
      ),
    ]);
  }

  private async handleMessage(message: unknown): Promise<void> {
    if (!isSidebarMessage(message)) {
      return;
    }

    if (message.type === "ready") {
      this.webviewReady = true;
      await this.publishState(this.controller.getState());
      return;
    }

    if (message.type === "toolbarState") {
      await this.setToolbarState(message.historyOpen, message.settingsOpen);
      return;
    }

    if (message.type === "selectFile") {
      await this.controller.selectFile(message.comparisonId, message.path);
      return;
    }

    if (message.type === "selectCommit") {
      await this.controller.selectCommit(message.sha);
      return;
    }

    if (message.type === "selectHistory") {
      await this.controller.selectHistory(message.mergeSha);
      return;
    }

    if (message.type !== "selectBranches") {
      return;
    }

    await this.controller.selectBranches(message.baseRef, message.headRef);
  }

  private async publishState(state: SidebarState): Promise<void> {
    await this.updateToolbarContext();
    const message: ExtensionToSidebarMessage = {
      type: "state",
      state,
    };
    await this.webview?.postMessage(message);
  }
}
