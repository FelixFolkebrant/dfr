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
      className={`file-tree-row file-tree-row--${node.kind}`}
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
      <span className="file-tree-leading" aria-hidden="true">
        {isFolder ? (
          <FolderChevronIcon />
        ) : (
          <FileStatusIcon status={node.file?.status ?? "unknown"} />
        )}
      </span>
      <span className="file-tree-name">{node.name}</span>
      {node.file && <FileMetadata file={node.file} />}
    </button>
  );
}

function FileMetadata({ file }: { file: DiffFileSummary }) {
  return (
    <span className="file-tree-metadata">
      <span className="sr-only">{statusLabels[file.status]}. </span>
      {file.isBinary ? (
        <span className="file-tree-binary">Binary</span>
      ) : (
        <>
          {file.additions ? (
            <span className="file-tree-additions">+{file.additions}</span>
          ) : null}
          {file.deletions ? (
            <span className="file-tree-deletions">-{file.deletions}</span>
          ) : null}
        </>
      )}
    </span>
  );
}
