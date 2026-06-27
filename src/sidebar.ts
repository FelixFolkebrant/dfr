import type * as vscode from "vscode";

import type { GitBackend, RepositoryContext } from "./git/GitBackend";
import { SidebarReviewController } from "./state/SidebarReviewController";
import { getLocalResourceRoots, renderWebviewDocument } from "./webview";
import type {
  ExtensionToSidebarMessage,
  SidebarToExtensionMessage,
} from "./webviews/protocol";

export class BranchDiffSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = "branchDiffReview.sidebar";

  private webview: vscode.Webview | undefined;
  private readonly controller: SidebarReviewController;

  constructor(
    private readonly extensionUri: vscode.Uri,
    gitBackend: GitBackend,
  ) {
    this.controller = new SidebarReviewController(gitBackend, (state) =>
      this.publishState(state),
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
    await this.controller.start(context);
  }

  private async handleMessage(message: unknown): Promise<void> {
    if (!isSidebarMessage(message)) {
      return;
    }

    if (message.type === "ready") {
      await this.publishState(this.controller.getState());
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

function isSidebarMessage(
  message: unknown,
): message is SidebarToExtensionMessage {
  if (!message || typeof message !== "object" || !("type" in message)) {
    return false;
  }

  if (message.type === "ready") {
    return true;
  }

  return (
    message.type === "selectBranches" &&
    "baseRef" in message &&
    typeof message.baseRef === "string" &&
    "headRef" in message &&
    typeof message.headRef === "string"
  );
}
