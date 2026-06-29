import crypto from "node:crypto";

import * as vscode from "vscode";

export type WebviewSurface = "sidebar";

const titles: Record<WebviewSurface, string> = {
  sidebar: "Branch Diff",
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
      content="default-src 'none'; img-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src ${webview.cspSource} 'nonce-${nonce}';"
    />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${titles[surface]}</title>
    <link href="${styleUri}" rel="stylesheet" />
  </head>
  <body data-surface="${surface}">
    <div id="app">
      <p role="status">Starting ${titles[surface]}…</p>
    </div>
    <script id="webview-script" nonce="${nonce}" type="module" src="${scriptUri}"></script>
    <script nonce="${nonce}">
      const app = document.querySelector("#app");
      const fail = (message) => {
        if (app) app.textContent = "${titles[surface]} failed to start: " + message;
      };

      window.addEventListener("error", ({ message }) => fail(message));
      document.querySelector("#webview-script")?.addEventListener("error", () => {
        fail("The bundled script could not be loaded: ${scriptUri}");
      });
      window.setTimeout(() => {
        if (app?.dataset.webviewMounted !== "true") {
          fail("The bundled script did not mount React.");
        }
      }, 3000);
    </script>
  </body>
</html>`;
}

export function getLocalResourceRoots(extensionUri: vscode.Uri): vscode.Uri[] {
  return [vscode.Uri.joinPath(extensionUri, "dist", "webview")];
}
