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

export interface FolderChangeSummary {
  additions: number;
  deletions: number;
  files: number;
}

export type DirectoryDisplay = "contextual" | "flattened" | "tree";

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

export function getFolderChangeSummary(
  node: ChangedFileTreeNode,
): FolderChangeSummary {
  return node.children.reduce<FolderChangeSummary>(
    (summary, child) => {
      if (child.file) {
        summary.files += 1;
        summary.additions += child.file.additions ?? 0;
        summary.deletions += child.file.deletions ?? 0;
        return summary;
      }

      const childSummary = getFolderChangeSummary(child);
      summary.files += childSummary.files;
      summary.additions += childSummary.additions;
      summary.deletions += childSummary.deletions;
      return summary;
    },
    { additions: 0, deletions: 0, files: 0 },
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

export function flattenChangedFiles(
  files: DiffFileSummary[],
  expandedPaths: ReadonlySet<string>,
): VisibleChangedFileTreeNode[] {
  const rootFiles: ChangedFileTreeNode[] = [];
  const groups = new Map<string, ChangedFileTreeNode>();

  for (const file of files) {
    const segments = file.path.split("/").filter(Boolean);
    const name = segments.pop() ?? file.path;
    const parentPath = segments.join("/") || undefined;
    const node: ChangedFileTreeNode = {
      children: [],
      file,
      kind: "file",
      name,
      ...(parentPath ? { parentPath } : {}),
      path: file.path,
    };

    if (!parentPath) {
      rootFiles.push(node);
      continue;
    }

    let group = groups.get(parentPath);
    if (!group) {
      group = {
        children: [],
        kind: "folder",
        name: parentPath,
        path: parentPath,
      };
      groups.set(parentPath, group);
    }
    group.children.push(node);
  }

  rootFiles.sort((left, right) => left.name.localeCompare(right.name));
  return [
    ...rootFiles.map((node) => ({ level: 1, node })),
    ...[...groups.values()]
      .sort((left, right) => left.path.localeCompare(right.path))
      .flatMap((group) => {
        group.children.sort((left, right) =>
          left.name.localeCompare(right.name),
        );
        return [
          { level: 1, node: group },
          ...(expandedPaths.has(group.path)
            ? group.children.map((node) => ({ level: 2, node }))
            : []),
        ];
      }),
  ];
}

export function buildContextualFileTree(
  repositoryFiles: string[],
  changedFiles: DiffFileSummary[],
): ChangedFileTreeNode[] {
  const changedByPath = new Map(changedFiles.map((file) => [file.path, file]));
  const roots: ChangedFileTreeNode[] = [];
  const folders = new Map<string, ChangedFileTreeNode>();

  for (const filePath of new Set([
    ...repositoryFiles,
    ...changedByPath.keys(),
  ])) {
    addPath(roots, folders, filePath, changedByPath.get(filePath));
  }

  sortNodes(roots);
  return roots;
}

export function getChangedAncestorPaths(files: DiffFileSummary[]): string[] {
  const paths = new Set<string>();
  for (const file of files) {
    const segments = file.path.split("/").filter(Boolean);
    segments.pop();
    for (let index = 1; index <= segments.length; index += 1) {
      paths.add(segments.slice(0, index).join("/"));
    }
  }
  return [...paths];
}

function addPath(
  roots: ChangedFileTreeNode[],
  folders: Map<string, ChangedFileTreeNode>,
  filePath: string,
  file?: DiffFileSummary,
): void {
  const segments = filePath.split("/").filter(Boolean);
  let children = roots;
  let parentPath: string | undefined;

  for (const [index, name] of segments.entries()) {
    const path = parentPath ? `${parentPath}/${name}` : name;
    const isFile = index === segments.length - 1;
    if (isFile) {
      children.push({
        children: [],
        ...(file ? { file } : {}),
        kind: "file",
        name,
        ...(parentPath ? { parentPath } : {}),
        path,
      });
      return;
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
