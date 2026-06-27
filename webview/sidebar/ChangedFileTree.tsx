import type { GitStatus, GitStatusEntry } from "@pierre/trees";
import { FileTree, useFileTree } from "@pierre/trees/react";
import type { DiffFileSummary, FileStatus } from "../../src/git/GitBackend";

interface ChangedFileTreeProps {
  files: DiffFileSummary[];
  onSelect(path: string): void;
  selectedPath?: string;
}

const gitStatuses: Partial<Record<FileStatus, GitStatus>> = {
  added: "added",
  deleted: "deleted",
  modified: "modified",
  renamed: "renamed",
};

export function ChangedFileTree({
  files,
  onSelect,
  selectedPath,
}: ChangedFileTreeProps) {
  const filesByPath = new Map(files.map((file) => [file.path, file]));
  const gitStatus = files.flatMap<GitStatusEntry>((file) => {
    const status = gitStatuses[file.status];
    return status ? [{ path: file.path, status }] : [];
  });
  const { model } = useFileTree({
    density: "compact",
    flattenEmptyDirectories: true,
    gitStatus,
    initialExpansion: "open",
    initialSelectedPaths: selectedPath ? [selectedPath] : [],
    onSelectionChange: (paths) => {
      for (let index = paths.length - 1; index >= 0; index -= 1) {
        const path = paths[index];
        if (path && filesByPath.has(path)) {
          onSelect(path);
          return;
        }
      }
    },
    paths: files.map((file) => file.path),
    renderRowDecoration: ({ item }) => {
      const file = filesByPath.get(item.path);
      if (!file) {
        return null;
      }
      if (file.isBinary) {
        return { text: "Binary", title: "Binary file" };
      }

      const additions = file.additions ? `+${file.additions}` : "";
      const deletions = file.deletions ? `-${file.deletions}` : "";
      const text = [additions, deletions].filter(Boolean).join(" ");
      return text ? { text, title: `${text} lines` } : null;
    },
  });

  return (
    <FileTree
      aria-label="Changed files"
      className="changed-file-tree"
      model={model}
      style={{
        height: `${Math.min(420, Math.max(96, files.length * 28 + 8))}px`,
      }}
    />
  );
}
