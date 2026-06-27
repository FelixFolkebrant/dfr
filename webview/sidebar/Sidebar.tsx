export function Sidebar() {
  return (
    <main className="grid gap-3 p-3.5 text-[var(--vscode-sideBar-foreground)]">
      <header className="panel">
        <p className="eyebrow">Placeholder sidebar</p>
        <h1 className="mb-2 text-lg font-semibold">Branch Diff</h1>
        <p className="muted">
          This issue only wires the review surfaces. Real branch discovery and
          Git comparison land in later issues.
        </p>
      </header>

      <section className="panel grid gap-2.5">
        <div className="grid gap-1.5">
          <label className="text-xs font-semibold" htmlFor="base-branch">
            Base
          </label>
          <select className="select" disabled id="base-branch">
            <option>main</option>
          </select>
        </div>
        <div className="grid gap-1.5">
          <label className="text-xs font-semibold" htmlFor="compare-branch">
            Compare
          </label>
          <select className="select" disabled id="compare-branch">
            <option>current branch</option>
          </select>
        </div>
      </section>

      <section className="panel grid gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <strong>Changed files</strong>
          <span>0 loaded</span>
        </div>
        <p className="muted">
          Future tree surface for added, modified, deleted, renamed, and binary
          files.
        </p>
        <ul className="list-disc pl-5 text-[var(--vscode-descriptionForeground)]">
          <li>src/</li>
          <li>components/</li>
          <li>DiffPanel.tsx</li>
        </ul>
      </section>

      <section className="panel grid gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <strong>Summary</strong>
          <span>Waiting for Git backend</span>
        </div>
        <p className="muted">
          No repository, branch, or patch data is queried in IS-001.
        </p>
      </section>
    </main>
  );
}
