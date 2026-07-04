import { useId, useRef, useState } from "react";
import type { ReviewCommit } from "../../../src/git/GitBackend";
import { ArrowIcon, CopyIcon, DropdownIcon } from "./Icons";
import { SelectDropdown, useDismissOnOutsidePointer } from "./SelectDropdown";

export type CommitNaming = "hash" | "hash-title" | "title";

interface CommitNavigationProps {
  commits: ReviewCommit[];
  disabled: boolean;
  naming: CommitNaming;
  onChange(sha: string | undefined): void;
  selectedSha: string | undefined;
}

export function CommitNavigation({
  commits,
  disabled,
  naming,
  onChange,
  selectedSha,
}: CommitNavigationProps) {
  const index = commits.findIndex((commit) => commit.sha === selectedSha);
  const selected = index >= 0 ? commits[index] : undefined;
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  useDismissOnOutsidePointer(rootRef, open, setOpen);

  const close = (restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  };

  return (
    <nav
      className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_34px_34px_34px] items-center gap-[5px] px-[3px] max-[240px]:grid-cols-[minmax(0,1fr)_auto_30px_30px_30px] max-[240px]:gap-0.5"
      aria-label="Commit navigation"
    >
      <div className="relative min-w-0" ref={rootRef}>
        <button
          aria-controls={`${id}-listbox`}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label="Diff scope"
          className="flex h-[34px] w-full min-w-0 cursor-pointer items-center gap-2 overflow-hidden border-0 bg-transparent px-[5px] text-left text-[var(--vscode-sideBar-foreground)] focus-visible:bg-[var(--vscode-list-hoverBackground)] focus-visible:outline-none disabled:cursor-progress disabled:opacity-65"
          disabled={disabled}
          onClick={() => setOpen((current) => !current)}
          ref={triggerRef}
          type="button"
        >
          <span className="min-w-0 flex-1 overflow-hidden">
            {selected ? (
              <CommitName commit={selected} naming={naming} />
            ) : (
              "All"
            )}
          </span>
          <span className="shrink-0 text-[var(--vscode-icon-foreground)]">
            <DropdownIcon />
          </span>
        </button>
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
              { label: "All", value: "" },
              ...commits.map((commit, commitIndex) => ({
                label: formatCommitName(commit, naming),
                content: (
                  <CommitName
                    commit={commit}
                    index={commitIndex}
                    naming={naming}
                  />
                ),
                value: commit.sha,
              })),
            ]}
            pinnedValue=""
            selectedValue={selectedSha ?? ""}
            showSearch={false}
          />
        )}
      </div>
      <span className="shrink-0 whitespace-nowrap text-xs font-medium text-[var(--vscode-descriptionForeground)] tabular-nums">
        {selected ? `${index + 1}/${commits.length}` : ""}
      </span>
      <button
        aria-label={copied ? "Commit hash copied" : "Copy commit hash"}
        className="grid size-8 cursor-pointer place-items-center rounded-[5px] border-0 bg-transparent text-[var(--vscode-icon-foreground)] hover:bg-[var(--vscode-toolbar-hoverBackground)] focus-visible:bg-[var(--vscode-toolbar-hoverBackground)] focus-visible:outline-none disabled:cursor-default disabled:opacity-35 max-[240px]:w-7"
        disabled={disabled || !selected}
        onClick={async () => {
          if (!selected) return;
          await navigator.clipboard.writeText(selected.sha);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        }}
        title={copied ? "Copied" : "Copy commit hash"}
        type="button"
      >
        <CopyIcon />
      </button>
      <button
        aria-label="Previous commit"
        className="grid size-8 cursor-pointer place-items-center rounded-[5px] border-0 bg-transparent text-[var(--vscode-icon-foreground)] hover:bg-[var(--vscode-toolbar-hoverBackground)] hover:text-[var(--vscode-toolbar-activeForeground,var(--vscode-foreground))] focus-visible:bg-[var(--vscode-toolbar-hoverBackground)] focus-visible:outline-none disabled:cursor-default disabled:opacity-35 max-[240px]:w-7"
        disabled={disabled || !selected || index === 0}
        onClick={() => onChange(commits[index - 1]?.sha)}
        type="button"
      >
        <ArrowIcon direction="left" />
      </button>
      <button
        aria-label="Next commit"
        className="grid size-8 cursor-pointer place-items-center rounded-[5px] border-0 bg-transparent text-[var(--vscode-icon-foreground)] hover:bg-[var(--vscode-toolbar-hoverBackground)] hover:text-[var(--vscode-toolbar-activeForeground,var(--vscode-foreground))] focus-visible:bg-[var(--vscode-toolbar-hoverBackground)] focus-visible:outline-none disabled:cursor-default disabled:opacity-35 max-[240px]:w-7"
        disabled={disabled || !selected || index === commits.length - 1}
        onClick={() => onChange(commits[index + 1]?.sha)}
        type="button"
      >
        <ArrowIcon direction="right" />
      </button>
    </nav>
  );
}

function formatCommitName(commit: ReviewCommit, naming: CommitNaming) {
  if (naming === "title") return commit.subject;
  if (naming === "hash-title") return `${commit.shortSha} ${commit.subject}`;
  return commit.shortSha;
}

function CommitName({
  commit,
  index,
  naming,
}: {
  commit: ReviewCommit;
  index?: number;
  naming: CommitNaming;
}) {
  const ordinal = index === undefined ? null : `${index + 1}.`;

  return (
    <span className="flex min-w-0 items-baseline gap-1.5">
      {ordinal && <span className="shrink-0 tabular-nums">{ordinal}</span>}
      {naming !== "title" && (
        <span
          className={
            naming === "hash-title"
              ? "truncate text-[var(--vscode-descriptionForeground)]"
              : ordinal
                ? "text-[var(--vscode-descriptionForeground)]"
                : ""
          }
        >
          {commit.shortSha}
        </span>
      )}
      {naming !== "hash" && (
        <span
          className={
            ordinal ? "min-w-0 break-words whitespace-normal" : "truncate"
          }
        >
          {commit.subject}
        </span>
      )}
    </span>
  );
}
