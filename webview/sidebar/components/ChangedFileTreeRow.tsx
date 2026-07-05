import type { CSSProperties, KeyboardEvent } from "react";
import type { DiffFileSummary, FileStatus } from "../../../src/git/GitBackend";
import type {
  DirectoryDisplay,
  VisibleChangedFileTreeNode,
} from "../../../src/webviews/fileTree";
import { getFolderChangeSummary } from "../../../src/webviews/fileTree";
import { FileStatusIcon, FolderChevronIcon, FolderIcon } from "./Icons";

interface ChangedFileTreeRowProps {
  directoryDisplay: DirectoryDisplay;
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
  directoryDisplay,
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
  const flattenedFileRow = directoryDisplay === "flattened" && !isFolder;
  const showFlattenedStatusIcon =
    flattenedFileRow &&
    (node.file?.status === "added" || node.file?.status === "deleted");
  const folderSummary = isFolder ? getFolderChangeSummary(node) : undefined;
  const showFolderSummary =
    !expanded && folderSummary !== undefined && folderSummary.files > 0;
  const dimmed =
    directoryDisplay === "contextual" && !node.file && !showFolderSummary;
  const rowBackground = selected
    ? "bg-[var(--vscode-list-activeSelectionBackground)]"
    : directoryDisplay === "contextual" && node.file
      ? node.file.status === "added"
        ? "bg-[color-mix(in_srgb,var(--vscode-gitDecoration-addedResourceForeground)_12%,transparent)]"
        : node.file.status === "deleted"
          ? "bg-[color-mix(in_srgb,var(--vscode-gitDecoration-deletedResourceForeground)_10%,transparent)]"
          : "bg-[color-mix(in_srgb,var(--vscode-gitDecoration-addedResourceForeground)_6%,transparent)]"
      : "bg-transparent";

  return (
    <button
      aria-expanded={isFolder ? expanded : undefined}
      aria-level={item.level}
      aria-selected={isFolder ? undefined : selected}
      className={`flex h-7 w-full min-w-0 items-center gap-0.5 border-0 pr-[5px] ${directoryDisplay === "flattened" ? "pl-[3px]" : "pl-[calc(3px+(var(--tree-level)-1)*16px)]"} text-left text-[var(--vscode-sideBar-foreground)] hover:bg-[var(--vscode-list-hoverBackground)] focus-visible:bg-[var(--vscode-list-hoverBackground)] focus-visible:outline-none ${isFolder || node.file ? "cursor-pointer" : "cursor-default"} ${rowBackground} ${dimmed ? "opacity-40" : ""} ${selected && !isFolder ? "text-[var(--vscode-list-activeSelectionForeground)]" : ""}`}
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
      {isFolder && directoryDisplay !== "flattened" && (
        <span
          className="grid size-[14px] shrink-0 place-items-center"
          aria-hidden="true"
        >
          <FolderChevronIcon expanded={expanded} />
        </span>
      )}
      {(!isFolder || directoryDisplay !== "flattened") &&
        (!flattenedFileRow || showFlattenedStatusIcon) && (
          <span
            className="grid size-[18px] shrink-0 place-items-center"
            aria-hidden="true"
          >
            {isFolder ? (
              <FolderIcon emphasized={showFolderSummary} expanded={expanded} />
            ) : (
              <FileStatusIcon status={node.file?.status ?? "unknown"} />
            )}
          </span>
        )}
      {directoryDisplay === "flattened" ? (
        <span
          className={`min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap ${isFolder ? "text-[10px] text-[var(--vscode-descriptionForeground)]" : ""}`}
        >
          {node.name}
        </span>
      ) : (
        <span
          className={`min-w-0 overflow-hidden text-ellipsis whitespace-nowrap ${isFolder ? `font-semibold ${showFolderSummary ? "" : "opacity-55"}` : ""}`}
        >
          {node.name}
        </span>
      )}
      {node.file && <FileMetadata file={node.file} />}
      {showFolderSummary && <FolderMetadata summary={folderSummary} />}
      {isFolder && directoryDisplay === "flattened" && (
        <span
          className="ml-auto grid size-[14px] shrink-0 place-items-center"
          aria-hidden="true"
        >
          <FolderChevronIcon expanded={expanded} />
        </span>
      )}
    </button>
  );
}

function FolderMetadata({
  summary,
}: {
  summary: { additions: number; deletions: number; files: number };
}) {
  return (
    <span className="ml-auto flex shrink-0 items-center gap-1.5 text-[11px] font-semibold tabular-nums">
      <span>
        {summary.files}
        <span className="sr-only"> changed files</span>
      </span>
      {summary.additions > 0 && (
        <span className="text-[var(--vscode-gitDecoration-addedResourceForeground)]">
          +{summary.additions}
        </span>
      )}
      {summary.deletions > 0 && (
        <span className="text-[var(--vscode-gitDecoration-deletedResourceForeground)]">
          -{summary.deletions}
        </span>
      )}
    </span>
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
