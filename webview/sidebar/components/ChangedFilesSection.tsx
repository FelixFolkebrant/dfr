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
    <section
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      aria-label="Changed files"
    >
      {ready?.comparison.files.length === 0 && (
        <p className="px-[3px] py-[7px] leading-[1.45] text-[var(--vscode-descriptionForeground)]">
          No files changed in this comparison.
        </p>
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
        <p className="px-[3px] py-[7px] text-[11px] leading-[1.45] text-[var(--vscode-descriptionForeground)]">
          Changed files appear after the comparison.
        </p>
      )}
    </section>
  );
}
