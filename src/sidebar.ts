import * as vscode from "vscode";

import type { GitBackend, RepositoryContext } from "./git/GitBackend";
import type { NativeDiffState } from "./panel";
import { SidebarReviewController } from "./state/SidebarReviewController";
import { getLocalResourceRoots, renderWebviewDocument } from "./webview";
import {
  type ExtensionToSidebarMessage,
  isSidebarMessage,
} from "./webviews/protocol";

export class BranchDiffSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = "branchDiffReview.sidebar";

  private webview: vscode.Webview | undefined;
  private readonly controller: SidebarReviewController;
  private repository: RepositoryContext["repository"] | undefined;

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
      }
    });
  }

  public async startReview(context: RepositoryContext): Promise<void> {
    this.repository = context.repository;
    await this.controller.start(context);
  }

  public async refreshReview(context: RepositoryContext): Promise<void> {
    this.repository = context.repository;
    await this.controller.refresh(context);
  }

  private async handleMessage(message: unknown): Promise<void> {
    if (!isSidebarMessage(message)) {
      return;
    }

    if (message.type === "ready") {
      await this.publishState(this.controller.getState());
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

    if (message.type === "openDocument") {
      if (this.repository && this.controller.hasDocument(message.path)) {
        const uri = vscode.Uri.joinPath(
          this.repository.rootUri,
          ...message.path.split("/"),
        );
        await vscode.window.showTextDocument(uri, { preview: true });
      }
      return;
    }

    if (message.type !== "selectBranches") {
      return;
    }

    await this.controller.selectBranches(message.baseRef, message.headRef);
  }

  private async publishState(
    state: ExtensionToSidebarMessage["state"],
  ): Promise<void> {
    const message: ExtensionToSidebarMessage = {
      type: "state",
      state,
    };
    await this.webview?.postMessage(message);
  }
}
