import type { CSSProperties, KeyboardEvent } from "react";
import type { DiffFileSummary, FileStatus } from "../../../src/git/GitBackend";
import type { VisibleChangedFileTreeNode } from "../../../src/webviews/fileTree";
import { FileStatusIcon, FolderChevronIcon } from "./Icons";

interface ChangedFileTreeRowProps {
  expanded: boolean;
  focused: boolean;
  item: VisibleChangedFileTreeNode;
  onActivate(): void;
  onFocus(): void;
  onKeyDown(event: KeyboardEvent<HTMLButtonElement>): void;
  register(element: HTMLButtonElement | null): void;
  selected: boolean;
}

const statusLabels: Record<FileStatus, string> = {
  added: "Added",
  deleted: "Deleted",
  modified: "Modified",
  renamed: "Renamed",
  unknown: "Changed",
};

export function ChangedFileTreeRow({
  expanded,
  focused,
  item,
  onActivate,
  onFocus,
  onKeyDown,
  register,
  selected,
}: ChangedFileTreeRowProps) {
  const { node } = item;
  const isFolder = node.kind === "folder";

  return (
    <button
      aria-expanded={isFolder ? expanded : undefined}
      aria-level={item.level}
      aria-selected={isFolder ? undefined : selected}
      className={`flex h-7 w-full min-w-0 cursor-pointer items-center gap-1.5 border-0 bg-transparent pr-[5px] pl-[calc(3px+(var(--tree-level)-1)*12px)] text-left text-[var(--vscode-sideBar-foreground)] hover:bg-[var(--vscode-list-hoverBackground)] focus-visible:bg-[var(--vscode-list-hoverBackground)] focus-visible:outline-none ${selected && !isFolder ? "bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]" : ""}`}
      data-status={node.file?.status}
      onClick={onActivate}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      ref={register}
      role="treeitem"
      style={{ "--tree-level": item.level } as CSSProperties}
      tabIndex={focused ? 0 : -1}
      type="button"
    >
      <span
        className="grid size-[18px] shrink-0 place-items-center"
        aria-hidden="true"
      >
        {isFolder ? (
          <FolderChevronIcon expanded={expanded} />
        ) : (
          <FileStatusIcon status={node.file?.status ?? "unknown"} />
        )}
      </span>
      <span
        className={`min-w-0 overflow-hidden text-ellipsis whitespace-nowrap ${isFolder ? "font-semibold opacity-55" : ""}`}
      >
        {node.name}
      </span>
      {node.file && <FileMetadata file={node.file} />}
    </button>
  );
}

function FileMetadata({ file }: { file: DiffFileSummary }) {
  return (
    <span className="ml-auto flex shrink-0 items-center gap-1.5 text-[11px] font-semibold tabular-nums">
      <span className="sr-only">{statusLabels[file.status]}. </span>
      {file.isBinary ? (
        <span className="font-normal text-[var(--vscode-descriptionForeground)]">
          Binary
        </span>
      ) : (
        <>
          {file.additions ? (
            <span className="text-[var(--vscode-gitDecoration-addedResourceForeground)]">
              +{file.additions}
            </span>
          ) : null}
          {file.deletions ? (
            <span className="text-[var(--vscode-gitDecoration-deletedResourceForeground)]">
              -{file.deletions}
            </span>
          ) : null}
        </>
      )}
    </span>
  );
}
