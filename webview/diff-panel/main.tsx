import { createRoot } from "react-dom/client";

function DiffPanelApp() {
  return (
    <main className="grid gap-4 p-6 text-[var(--vscode-editor-foreground)]">
      <section className="panel">
        <p className="eyebrow">Placeholder review panel</p>
        <h1 className="mb-2.5 text-3xl font-semibold">Branch Diff Review</h1>
        <p className="lede">
          The command opens the main review surface now. Real merge-base
          diffing, file patches, and native diff fallback are intentionally out
          of scope for this issue.
        </p>
      </section>

      <section className="panel">
        <div className="flex flex-wrap gap-2.5">
          <span className="pill">Base: main</span>
          <span className="pill">Compare: current branch</span>
          <span className="pill pill-muted">Status: placeholder only</span>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="panel min-h-64">
          <h2 className="mb-2 text-xl font-semibold">Changed files</h2>
          <p className="copy">
            Sidebar navigation will eventually drive file selection here.
          </p>
          <ul className="copy mt-3 list-disc pl-5">
            <li>No Git data loaded yet</li>
            <li>No merge-base computed yet</li>
            <li>No file tree interaction yet</li>
          </ul>
        </article>

        <article className="panel min-h-64">
          <h2 className="mb-2 text-xl font-semibold">Selected file diff</h2>
          <p className="copy">
            This placeholder reserves the future unified diff surface where{" "}
            <code>@pierre/diffs</code> can render the selected file patch.
          </p>
          <div className="mt-4 grid min-h-36 place-items-center rounded-md border border-dashed border-[var(--vscode-textLink-foreground)] text-[var(--vscode-textLink-foreground)]">
            <span>Diff output deferred to later issues</span>
          </div>
        </article>
      </section>
    </main>
  );
}

const app = document.querySelector("#app");

if (!app) {
  throw new Error("Diff panel app root was not found.");
}

createRoot(app).render(<DiffPanelApp />);
