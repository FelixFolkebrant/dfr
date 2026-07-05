import { useId, useRef, useState } from "react";
import type { MergedBranch, ReviewCommit } from "../../../src/git/GitBackend";
import { HistoryNavigation } from "./HistoryNavigation";
import { ArrowIcon, CopyIcon, GearIcon, HistoryIcon } from "./Icons";
import { SelectDropdown, useDismissOnOutsidePointer } from "./SelectDropdown";

interface CommitNavigationProps {
  allChangesTitle: string;
  commits: ReviewCommit[];
  disabled: boolean;
  historyBranches: MergedBranch[];
  historyDisabled: boolean;
  historyOpen: boolean;
  onChange(sha: string | undefined): void;
  onHistoryChange(mergeSha: string | undefined): void;
  onHistoryToggle(): void;
  onSettingsToggle(): void;
  selectedHistorySha: string | undefined;
  selectedSha: string | undefined;
  settingsOpen: boolean;
  totals?: { files: number; additions: number; deletions: number };
}

export function CommitNavigation({
  allChangesTitle,
  commits,
  disabled,
  historyBranches,
  historyDisabled,
  historyOpen,
  onChange,
  onHistoryChange,
  onHistoryToggle,
  onSettingsToggle,
  selectedHistorySha,
  selectedSha,
  settingsOpen,
  totals,
}: CommitNavigationProps) {
  const index = commits.findIndex((commit) => commit.sha === selectedSha);
  const selected = index >= 0 ? commits[index] : undefined;
  const newestFirst = commits
    .map((commit, commitIndex) => ({
      commit,
      index: commitIndex,
    }))
    .reverse();
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  useDismissOnOutsidePointer(rootRef, open, setOpen);

  const close = (restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const selectedStats = selected
    ? {
        files: selected.filesChanged,
        additions: selected.additions,
        deletions: selected.deletions,
      }
    : totals;

  return (
    <nav
      className="flex min-w-0 flex-col px-[3px]"
      aria-label="Review navigation"
    >
      {historyOpen && (
        <HistoryNavigation
          branches={historyBranches}
          disabled={historyDisabled}
          onChange={onHistoryChange}
          selectedSha={selectedHistorySha}
        />
      )}
      <section
        aria-label="Commit scope"
        className="commit-submenu -mx-3 px-[15px] py-1.5"
      >
        <div className="relative min-w-0" ref={rootRef}>
          <div className="commit-scope relative min-h-12 min-w-0">
            <button
              aria-controls={`${id}-listbox`}
              aria-expanded={open}
              aria-haspopup="listbox"
              aria-label="Select commit scope"
              className="peer absolute inset-0 w-full cursor-pointer rounded-[4px] border-0 bg-transparent focus-visible:bg-[var(--vscode-list-hoverBackground)] focus-visible:outline-none disabled:cursor-progress disabled:opacity-65"
              disabled={disabled}
              onClick={() => setOpen((current) => !current)}
              ref={triggerRef}
              type="button"
            />
            <div className="pointer-events-none relative flex min-h-12 min-w-0 items-center gap-2 px-1.5 py-1 text-[var(--vscode-sideBar-foreground)] peer-hover:bg-[var(--vscode-list-hoverBackground)] peer-disabled:opacity-65">
              <CommitEntry
                commit={selected}
                emptyTitle={allChangesTitle}
                index={selected ? index : undefined}
                stats={selectedStats}
                total={commits.length}
              />
            </div>
          </div>
          {open && (
            <SelectDropdown
              id={id}
              label="Commit scopes"
              onClose={close}
              onSelect={(sha) => {
                onChange(sha || undefined);
                close(true);
              }}
              options={[
                {
                  content: (
                    <CommitEntry
                      showTitle={false}
                      stats={totals}
                      total={commits.length}
                    />
                  ),
                  label: "All changes",
                  value: "",
                },
                ...newestFirst.map(({ commit, index: commitIndex }) => ({
                  content: (
                    <CommitEntry
                      commit={commit}
                      index={commitIndex}
                      stats={{
                        files: commit.filesChanged,
                        additions: commit.additions,
                        deletions: commit.deletions,
                      }}
                      total={commits.length}
                    />
                  ),
                  label: `${commitIndex + 1}. ${commit.subject} ${commit.shortSha}`,
                  value: commit.sha,
                })),
              ]}
              pinnedValue=""
              selectedValue={selectedSha ?? ""}
              showSearch={commits.length > 8}
            />
          )}
        </div>
      </section>
      <div className="mt-1 flex min-w-0 items-center justify-end gap-0.5">
        <button
          aria-label="Previous commit"
          className="grid size-8 cursor-pointer place-items-center rounded-[5px] border-0 bg-transparent text-[var(--vscode-icon-foreground)] hover:bg-[var(--vscode-toolbar-hoverBackground)] focus-visible:bg-[var(--vscode-toolbar-hoverBackground)] focus-visible:outline-none disabled:cursor-default disabled:opacity-35"
          disabled={disabled || commits.length === 0}
          onClick={() =>
            onChange(
              selected && index > 0
                ? commits[index - 1]?.sha
                : selected
                  ? undefined
                  : commits.at(-1)?.sha,
            )
          }
          type="button"
        >
          <ArrowIcon direction="left" />
        </button>
        <button
          aria-label="Next commit"
          className="grid size-8 cursor-pointer place-items-center rounded-[5px] border-0 bg-transparent text-[var(--vscode-icon-foreground)] hover:bg-[var(--vscode-toolbar-hoverBackground)] focus-visible:bg-[var(--vscode-toolbar-hoverBackground)] focus-visible:outline-none disabled:cursor-default disabled:opacity-35"
          disabled={disabled || commits.length === 0}
          onClick={() =>
            onChange(
              selected && index < commits.length - 1
                ? commits[index + 1]?.sha
                : selected
                  ? undefined
                  : commits[0]?.sha,
            )
          }
          type="button"
        >
          <ArrowIcon direction="right" />
        </button>
        <button
          aria-label={historyOpen ? "Close history" : "Open history"}
          aria-pressed={historyOpen}
          className="grid size-8 cursor-pointer place-items-center rounded-[5px] border-0 bg-transparent text-[var(--vscode-icon-foreground)] hover:bg-[var(--vscode-toolbar-hoverBackground)] focus-visible:bg-[var(--vscode-toolbar-hoverBackground)] focus-visible:outline-none aria-pressed:bg-[var(--vscode-toolbar-hoverBackground)]"
          onClick={onHistoryToggle}
          title="History"
          type="button"
        >
          <HistoryIcon />
        </button>
        <button
          aria-label="Copy hash"
          className="grid size-8 cursor-pointer place-items-center rounded-[5px] border-0 bg-transparent text-[var(--vscode-icon-foreground)] hover:bg-[var(--vscode-toolbar-hoverBackground)] focus-visible:bg-[var(--vscode-toolbar-hoverBackground)] focus-visible:outline-none disabled:cursor-default disabled:opacity-35"
          disabled={!selected}
          onClick={() => {
            if (selected) void navigator.clipboard.writeText(selected.sha);
          }}
          title="Copy hash"
          type="button"
        >
          <CopyIcon />
        </button>
        <button
          aria-label={
            settingsOpen
              ? "Close comparison settings"
              : "Open comparison settings"
          }
          aria-pressed={settingsOpen}
          className="grid size-8 cursor-pointer place-items-center rounded-[5px] border-0 bg-transparent text-[var(--vscode-icon-foreground)] hover:bg-[var(--vscode-toolbar-hoverBackground)] focus-visible:bg-[var(--vscode-toolbar-hoverBackground)] focus-visible:outline-none aria-pressed:bg-[var(--vscode-toolbar-hoverBackground)]"
          onClick={onSettingsToggle}
          title="Comparison settings"
          type="button"
        >
          <GearIcon />
        </button>
      </div>
    </nav>
  );
}

function CommitEntry({
  commit,
  emptyTitle = "All changes",
  index,
  showOrdinal = true,
  showTitle = true,
  stats,
  total,
}: {
  commit?: ReviewCommit;
  emptyTitle?: string;
  index?: number;
  showOrdinal?: boolean;
  showTitle?: boolean;
  stats?: { files: number; additions: number; deletions: number };
  total: number;
}) {
  return (
    <span className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center">
      {showTitle && (
        <span className="col-span-2 min-w-0 truncate font-medium">
          {commit?.subject ?? emptyTitle}
        </span>
      )}
      {showOrdinal && (
        <span className="min-w-0 text-[10px] font-normal text-[var(--vscode-descriptionForeground)] opacity-55 tabular-nums">
          {index === undefined ? "All" : `${index + 1}/${total}`}
        </span>
      )}
      {stats && (
        <span className="col-start-2 flex shrink-0 items-center justify-self-end gap-x-2 whitespace-nowrap text-[11px] text-[var(--vscode-descriptionForeground)] tabular-nums">
          <span>
            {stats.files} {stats.files === 1 ? "file" : "files"}
          </span>
          <span className="text-[var(--vscode-gitDecoration-addedResourceForeground,#2ea043)]">
            +{stats.additions}
          </span>
          <span className="text-[var(--vscode-gitDecoration-deletedResourceForeground,#f85149)]">
            −{stats.deletions}
          </span>
        </span>
      )}
    </span>
  );
}
