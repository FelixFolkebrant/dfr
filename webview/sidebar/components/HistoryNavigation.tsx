import { useId, useRef, useState } from "react";
import type { MergedBranch } from "../../../src/git/GitBackend";
import { ArrowIcon } from "./Icons";
import { useDismissOnOutsidePointer } from "./SelectDropdown";

interface HistoryNavigationProps {
  branches: MergedBranch[];
  disabled: boolean;
  onChange(mergeSha: string | undefined): void;
  selectedSha: string | undefined;
}

export function HistoryNavigation({
  branches,
  disabled,
  onChange,
  selectedSha,
}: HistoryNavigationProps) {
  const chronologicalIndex = branches.findIndex(
    (branch) => branch.mergeSha === selectedSha,
  );
  const selected = branches[chronologicalIndex];
  const newestFirst = [...branches].reverse();
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  useDismissOnOutsidePointer(rootRef, open, setOpen);

  const select = (mergeSha: string | undefined) => {
    onChange(mergeSha);
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  return (
    <section
      aria-label="Merged branch history"
      className="history-submenu -mx-3 px-[15px] py-1.5"
    >
      <div className="relative flex min-w-0 items-center gap-1" ref={rootRef}>
        <button
          aria-controls={`${id}-tree`}
          aria-expanded={open}
          aria-haspopup="listbox"
          className="flex min-h-9 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-[4px] border-0 bg-transparent px-1.5 py-0.5 text-left text-[var(--vscode-sideBar-foreground)] hover:bg-[var(--vscode-list-hoverBackground)] focus-visible:bg-[var(--vscode-list-hoverBackground)] focus-visible:outline-none disabled:cursor-default disabled:opacity-50"
          disabled={disabled || branches.length === 0}
          onClick={() => setOpen((current) => !current)}
          onPointerDown={(event) => {
            if (open) event.preventDefault();
          }}
          ref={triggerRef}
          type="button"
        >
          <span className="min-w-0 flex-1">
            {selected ? (
              <BranchDetails branch={selected} showTitle={false} />
            ) : (
              <span className="font-medium">
                {branches.length ? "Current review" : "No merged branches"}
              </span>
            )}
          </span>
        </button>
        <button
          aria-label="Move up the history tree"
          className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-[5px] border-0 bg-transparent text-[var(--vscode-icon-foreground)] hover:bg-[var(--vscode-toolbar-hoverBackground)] focus-visible:bg-[var(--vscode-toolbar-hoverBackground)] focus-visible:outline-none disabled:cursor-default disabled:opacity-35"
          disabled={disabled || !selected}
          onClick={() =>
            onChange(
              chronologicalIndex < branches.length - 1
                ? branches[chronologicalIndex + 1]?.mergeSha
                : undefined,
            )
          }
          type="button"
        >
          <ArrowIcon direction="up" />
        </button>
        <button
          aria-label="Move down the history tree"
          className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-[5px] border-0 bg-transparent text-[var(--vscode-icon-foreground)] hover:bg-[var(--vscode-toolbar-hoverBackground)] focus-visible:bg-[var(--vscode-toolbar-hoverBackground)] focus-visible:outline-none disabled:cursor-default disabled:opacity-35"
          disabled={
            disabled ||
            branches.length === 0 ||
            (selected !== undefined && chronologicalIndex === 0)
          }
          onClick={() =>
            onChange(
              selected
                ? branches[chronologicalIndex - 1]?.mergeSha
                : branches.at(-1)?.mergeSha,
            )
          }
          type="button"
        >
          <ArrowIcon direction="down" />
        </button>

        {open && (
          <fieldset
            aria-label="Merged branches"
            className="history-tree absolute top-[calc(100%+5px)] right-0 left-0 z-20 m-0 max-h-[min(520px,70vh)] overflow-auto rounded-[7px] border border-[var(--vscode-dropdown-border,var(--vscode-contrastBorder,transparent))] bg-[var(--vscode-dropdown-listBackground,var(--vscode-dropdown-background))] p-1 shadow-[0_4px_12px_var(--vscode-widget-shadow,#0005)]"
            id={`${id}-tree`}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setOpen(false);
                triggerRef.current?.focus();
              }
            }}
          >
            <HistoryOption
              label="Current review"
              onSelect={() => select(undefined)}
              selected={!selected}
            />
            <div className="mt-1 border-t border-[var(--vscode-dropdown-border,var(--vscode-contrastBorder,transparent))] pt-1">
              {newestFirst.map((branch) => (
                <HistoryOption
                  branch={branch}
                  key={branch.mergeSha}
                  onSelect={() => select(branch.mergeSha)}
                  selected={branch.mergeSha === selectedSha}
                />
              ))}
            </div>
          </fieldset>
        )}
      </div>
    </section>
  );
}

function BranchDetails({
  branch,
  showStats = false,
  showTitle = true,
}: {
  branch: MergedBranch;
  showStats?: boolean;
  showTitle?: boolean;
}) {
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      {showTitle && (
        <span className="min-w-0 truncate font-medium">{branch.title}</span>
      )}
      <span className="flex min-w-0 items-center gap-x-2 text-[11px] text-[var(--vscode-descriptionForeground)] tabular-nums">
        <span className="history-branch-name min-w-0 truncate opacity-75">
          {branch.name}
        </span>
        {showStats && (
          <span className="ml-auto flex shrink-0 items-center gap-x-2">
            <span>
              {branch.commitCount}{" "}
              {branch.commitCount === 1 ? "commit" : "commits"}
            </span>
            <span className="text-[var(--vscode-gitDecoration-addedResourceForeground,#2ea043)]">
              +{branch.additions}
            </span>
            <span className="text-[var(--vscode-gitDecoration-deletedResourceForeground,#f85149)]">
              −{branch.deletions}
            </span>
          </span>
        )}
      </span>
    </span>
  );
}

function HistoryOption({
  branch,
  label,
  onSelect,
  selected,
}: {
  branch?: MergedBranch;
  label?: string;
  onSelect(): void;
  selected: boolean;
}) {
  return (
    <button
      aria-selected={selected}
      className={`flex min-h-10 w-full min-w-0 cursor-pointer items-center rounded-sm border-0 px-2 py-1.5 text-left focus-visible:outline-none ${
        selected
          ? "bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]"
          : "bg-transparent text-[var(--vscode-dropdown-foreground)] hover:bg-[var(--vscode-list-hoverBackground)] focus-visible:bg-[var(--vscode-list-hoverBackground)]"
      }`}
      onClick={onSelect}
      role="option"
      type="button"
    >
      <span className="min-w-0 flex-1">
        {branch ? (
          <BranchDetails branch={branch} showStats />
        ) : (
          <span>{label}</span>
        )}
      </span>
    </button>
  );
}
