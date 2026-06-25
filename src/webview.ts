import crypto from "node:crypto";

import * as vscode from "vscode";

export type WebviewSurface = "sidebar" | "diff-panel";

const titles: Record<WebviewSurface, string> = {
  sidebar: "Branch Diff",
  "diff-panel": "Branch Diff Review",
};

export function renderWebviewDocument(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  surface: WebviewSurface,
): string {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "dist", "webview", `${surface}.js`),
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "dist", "webview", `${surface}.css`),
  );

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; img-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';"
    />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${titles[surface]}</title>
    <link href="${styleUri}" rel="stylesheet" />
  </head>
  <body data-surface="${surface}">
    <div id="app"></div>
    <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
  </body>
</html>`;
}

export function getLocalResourceRoots(extensionUri: vscode.Uri): vscode.Uri[] {
  return [vscode.Uri.joinPath(extensionUri, "dist", "webview")];
}

export function getPanelColumn(): vscode.ViewColumn {
  return vscode.ViewColumn.Active;
}
