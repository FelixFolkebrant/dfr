import type { SidebarState } from "../../../src/webviews/protocol";
import { ChangedFileTree } from "./ChangedFileTree";

type ActiveSidebarState = Exclude<SidebarState, { status: "idle" }>;

interface ChangedFilesSectionProps {
  onSelect(comparisonId: string, path: string): void;
  state: ActiveSidebarState;
}

export function ChangedFilesSection({
  onSelect,
  state,
}: ChangedFilesSectionProps) {
  const ready = state.status === "ready" ? state : undefined;

  return (
    <section className="changes">
      <div className="changes-header">
        <h2>Files changed</h2>
        {ready && (
          <span className="file-count">{ready.comparison.totals.files}</span>
        )}
      </div>
      {ready?.comparison.files.length === 0 && (
        <p className="muted">No files changed in this comparison.</p>
      )}
      {ready && ready.comparison.files.length > 0 && (
        <ChangedFileTree
          key={ready.comparison.id}
          files={ready.comparison.files}
          onSelect={(path) => onSelect(ready.comparison.id, path)}
          selectedPath={ready.selectedPath}
        />
      )}
      {!ready && (
        <p className="muted">Changed files appear after the comparison.</p>
      )}
    </section>
  );
}
