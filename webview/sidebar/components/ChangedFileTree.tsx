import { type KeyboardEvent, useMemo, useRef, useState } from "react";
import type { DiffFileSummary } from "../../../src/git/GitBackend";
import {
  buildChangedFileTree,
  flattenChangedFileTree,
  getFolderPaths,
  type VisibleChangedFileTreeNode,
} from "../../../src/webviews/fileTree";
import { ChangedFileTreeRow } from "./ChangedFileTreeRow";

interface ChangedFileTreeProps {
  files: DiffFileSummary[];
  onSelect(path: string): void;
  selectedPath?: string;
}

export function ChangedFileTree({
  files,
  onSelect,
  selectedPath,
}: ChangedFileTreeProps) {
  const nodes = useMemo(() => buildChangedFileTree(files), [files]);
  const [expandedPaths, setExpandedPaths] = useState(
    () => new Set(getFolderPaths(nodes)),
  );
  const visibleNodes = useMemo(
    () => flattenChangedFileTree(nodes, expandedPaths),
    [expandedPaths, nodes],
  );
  const [focusedPath, setFocusedPath] = useState(
    selectedPath ?? visibleNodes[0]?.node.path,
  );
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());

  const focus = (path: string | undefined) => {
    if (!path) {
      return;
    }
    setFocusedPath(path);
    requestAnimationFrame(() => rowRefs.current.get(path)?.focus());
  };

  const toggleFolder = (path: string, expand?: boolean) => {
    setExpandedPaths((current) => {
      const next = new Set(current);
      const shouldExpand = expand ?? !next.has(path);
      if (shouldExpand) {
        next.add(path);
      } else {
        next.delete(path);
      }
      return next;
    });
  };

  const activate = (item: VisibleChangedFileTreeNode) => {
    const { node } = item;
    if (node.kind === "folder") {
      toggleFolder(node.path);
    } else {
      onSelect(node.path);
    }
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    item: VisibleChangedFileTreeNode,
    index: number,
  ) => {
    const { node } = item;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const offset = event.key === "ArrowDown" ? 1 : -1;
      focus(visibleNodes[index + offset]?.node.path);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      focus(
        event.key === "Home"
          ? visibleNodes[0]?.node.path
          : visibleNodes.at(-1)?.node.path,
      );
    } else if (event.key === "ArrowRight" && node.kind === "folder") {
      event.preventDefault();
      if (expandedPaths.has(node.path)) {
        focus(visibleNodes[index + 1]?.node.path);
      } else {
        toggleFolder(node.path, true);
      }
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (node.kind === "folder" && expandedPaths.has(node.path)) {
        toggleFolder(node.path, false);
      } else {
        focus(node.parentPath);
      }
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activate(item);
    }
  };

  return (
    <div
      aria-label="Changed files"
      className="min-h-0 flex-1 overflow-y-auto border-t border-[var(--vscode-sideBar-border,var(--vscode-panel-border))] py-1 pr-0.5"
      role="tree"
    >
      {visibleNodes.map((item, index) => (
        <ChangedFileTreeRow
          expanded={expandedPaths.has(item.node.path)}
          focused={item.node.path === focusedPath}
          item={item}
          key={item.node.path}
          onActivate={() => activate(item)}
          onFocus={() => setFocusedPath(item.node.path)}
          onKeyDown={(event) => handleKeyDown(event, item, index)}
          register={(element) => {
            if (element) {
              rowRefs.current.set(item.node.path, element);
            } else {
              rowRefs.current.delete(item.node.path);
            }
          }}
          selected={item.node.path === selectedPath}
        />
      ))}
    </div>
  );
}
