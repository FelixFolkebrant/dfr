import type { DirectoryDisplay } from "../../../src/webviews/fileTree";
import type { SidebarState } from "../../../src/webviews/protocol";
import { ChangedFileTree } from "./ChangedFileTree";
import { ChangesViewIcon } from "./Icons";

type ActiveSidebarState = Exclude<SidebarState, { status: "idle" }>;

interface ChangedFilesSectionProps {
  directoryDisplay: DirectoryDisplay;
  onDirectoryDisplayChange(value: DirectoryDisplay): void;
  onSelect(comparisonId: string, path: string): void;
  state: ActiveSidebarState;
}

export function ChangedFilesSection({
  directoryDisplay,
  onDirectoryDisplayChange,
  onSelect,
  state,
}: ChangedFilesSectionProps) {
  const ready = state.status === "ready" ? state : undefined;

  return (
    <section
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      aria-label="Changed files"
    >
      <div className="flex h-7 shrink-0 items-center justify-between px-[3px]">
        <span>Changes</span>
        <div className="flex items-center gap-1">
          <fieldset
            aria-label="Changes view"
            className="m-0 flex items-center gap-px border-0 p-0"
          >
            {(
              [
                ["tree", "Tree view"],
                ["flattened", "Flattened view"],
                ["contextual", "Contextual view"],
              ] as const
            ).map(([view, label]) => (
              <button
                aria-label={label}
                aria-pressed={directoryDisplay === view}
                className="grid size-6 cursor-pointer place-items-center rounded border-0 bg-transparent text-[var(--vscode-icon-foreground)] hover:bg-[var(--vscode-toolbar-hoverBackground)] focus-visible:bg-[var(--vscode-toolbar-hoverBackground)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--vscode-focusBorder)] aria-pressed:bg-[var(--vscode-toolbar-hoverBackground)] aria-pressed:text-[var(--vscode-toolbar-activeForeground,var(--vscode-foreground))]"
                key={view}
                onClick={() => onDirectoryDisplayChange(view)}
                title={label}
                type="button"
              >
                <ChangesViewIcon view={view} />
              </button>
            ))}
          </fieldset>
        </div>
      </div>
      {ready?.comparison.files.length === 0 && (
        <p className="px-[3px] py-[7px] leading-[1.45] text-[var(--vscode-descriptionForeground)]">
          No files changed in this comparison.
        </p>
      )}
      {ready && ready.comparison.files.length > 0 && (
        <ChangedFileTree
          directoryDisplay={directoryDisplay}
          key={ready.comparison.id}
          files={ready.comparison.files}
          repositoryFiles={ready.comparison.repositoryFiles}
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
