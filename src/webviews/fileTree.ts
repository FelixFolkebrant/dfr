import type { DiffFileSummary } from "../git/GitBackend";

export interface ChangedFileTreeNode {
  children: ChangedFileTreeNode[];
  file?: DiffFileSummary;
  kind: "file" | "folder";
  name: string;
  parentPath?: string;
  path: string;
}

export interface VisibleChangedFileTreeNode {
  level: number;
  node: ChangedFileTreeNode;
}

export function buildChangedFileTree(
  files: DiffFileSummary[],
): ChangedFileTreeNode[] {
  const roots: ChangedFileTreeNode[] = [];
  const folders = new Map<string, ChangedFileTreeNode>();

  for (const file of files) {
    const segments = file.path.split("/").filter(Boolean);
    let children = roots;
    let parentPath: string | undefined;

    for (const [index, name] of segments.entries()) {
      const path = parentPath ? `${parentPath}/${name}` : name;
      const isFile = index === segments.length - 1;

      if (isFile) {
        children.push({
          children: [],
          file,
          kind: "file",
          name,
          ...(parentPath ? { parentPath } : {}),
          path,
        });
        continue;
      }

      let folder = folders.get(path);
      if (!folder) {
        folder = {
          children: [],
          kind: "folder",
          name,
          ...(parentPath ? { parentPath } : {}),
          path,
        };
        folders.set(path, folder);
        children.push(folder);
      }

      children = folder.children;
      parentPath = path;
    }
  }

  sortNodes(roots);
  return roots;
}

export function getFolderPaths(nodes: ChangedFileTreeNode[]): string[] {
  return nodes.flatMap((node) =>
    node.kind === "folder" ? [node.path, ...getFolderPaths(node.children)] : [],
  );
}

export function flattenChangedFileTree(
  nodes: ChangedFileTreeNode[],
  expandedPaths: ReadonlySet<string>,
  level = 1,
): VisibleChangedFileTreeNode[] {
  return nodes.flatMap((node) => [
    { level, node },
    ...(node.kind === "folder" && expandedPaths.has(node.path)
      ? flattenChangedFileTree(node.children, expandedPaths, level + 1)
      : []),
  ]);
}

function sortNodes(nodes: ChangedFileTreeNode[]): void {
  nodes.sort(
    (left, right) =>
      Number(left.kind === "file") - Number(right.kind === "file") ||
      left.name.localeCompare(right.name),
  );

  for (const node of nodes) {
    sortNodes(node.children);
  }
}
