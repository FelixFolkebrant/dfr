import crypto from "node:crypto";

import * as vscode from "vscode";

export type WebviewSurface = "sidebar" | "diff-panel";

const titles: Record<WebviewSurface, string> = {
  sidebar: "Branch Diff",
  "diff-panel": "Branch Diff Review",
};

const fallbackContent: Record<WebviewSurface, string> = {
  sidebar: `<main class="grid gap-3 p-3.5 text-[var(--vscode-sideBar-foreground)]">
      <header class="panel">
        <p class="eyebrow">Placeholder sidebar</p>
        <h1 class="mb-2 text-lg font-semibold">Branch Diff</h1>
        <p class="muted">
          This issue only wires the review surfaces. Real branch discovery and
          Git comparison land in later issues.
        </p>
      </header>

      <section class="panel grid gap-2.5">
        <div class="grid gap-1.5">
          <label class="text-xs font-semibold" for="base-branch">Base</label>
          <select class="select" disabled id="base-branch">
            <option>main</option>
          </select>
        </div>
        <div class="grid gap-1.5">
          <label class="text-xs font-semibold" for="compare-branch">Compare</label>
          <select class="select" disabled id="compare-branch">
            <option>current branch</option>
          </select>
        </div>
      </section>

      <section class="panel grid gap-2.5">
        <div class="flex items-center justify-between gap-2">
          <strong>Changed files</strong>
          <span>0 loaded</span>
        </div>
        <p class="muted">
          Future tree surface for added, modified, deleted, renamed, and binary
          files.
        </p>
        <ul class="list-disc pl-5 text-[var(--vscode-descriptionForeground)]">
          <li>src/</li>
          <li>components/</li>
          <li>DiffPanel.tsx</li>
        </ul>
      </section>

      <section class="panel grid gap-2.5">
        <div class="flex items-center justify-between gap-2">
          <strong>Summary</strong>
          <span>Waiting for Git backend</span>
        </div>
        <p class="muted">
          No repository, branch, or patch data is queried in IS-001.
        </p>
      </section>
    </main>`,
  "diff-panel": `<main class="grid gap-4 p-6 text-[var(--vscode-editor-foreground)]">
      <section class="panel">
        <p class="eyebrow">Placeholder review panel</p>
        <h1 class="mb-2.5 text-3xl font-semibold">Branch Diff Review</h1>
        <p class="lede">
          The command opens the main review surface now. Real merge-base
          diffing, file patches, and native diff fallback are intentionally out
          of scope for this issue.
        </p>
      </section>

      <section class="panel">
        <div class="flex flex-wrap gap-2.5">
          <span class="pill">Base: main</span>
          <span class="pill">Compare: current branch</span>
          <span class="pill pill-muted">Status: placeholder only</span>
        </div>
      </section>

      <section class="grid gap-4 md:grid-cols-2">
        <article class="panel min-h-64">
          <h2 class="mb-2 text-xl font-semibold">Changed files</h2>
          <p class="copy">
            Sidebar navigation will eventually drive file selection here.
          </p>
          <ul class="copy mt-3 list-disc pl-5">
            <li>No Git data loaded yet</li>
            <li>No merge-base computed yet</li>
            <li>No file tree interaction yet</li>
          </ul>
        </article>

        <article class="panel min-h-64">
          <h2 class="mb-2 text-xl font-semibold">Selected file diff</h2>
          <p class="copy">
            This placeholder reserves the future unified diff surface where
            @pierre/diffs can render the selected file patch.
          </p>
          <div class="mt-4 grid min-h-36 place-items-center rounded-md border border-dashed border-[var(--vscode-textLink-foreground)] text-[var(--vscode-textLink-foreground)]">
            <span>Diff output deferred to later issues</span>
          </div>
        </article>
      </section>
    </main>`,
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
    <div id="app">${fallbackContent[surface]}</div>
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
