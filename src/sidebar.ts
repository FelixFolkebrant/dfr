import type * as vscode from "vscode";

import { getLocalResourceRoots, renderWebviewDocument } from "./webview";

export class BranchDiffSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = "branchDiffReview.sidebar";

  constructor(private readonly extensionUri: vscode.Uri) {}

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: getLocalResourceRoots(this.extensionUri),
    };
    webviewView.webview.html = renderWebviewDocument(
      webviewView.webview,
      this.extensionUri,
      "sidebar",
    );
  }
}
