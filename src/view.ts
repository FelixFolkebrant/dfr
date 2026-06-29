import * as vscode from "vscode";

import type {
  BranchRef,
  DiffFileSummary,
  FileStatus,
  GitBackend,
  RepositoryContext,
} from "./git/GitBackend";
import type { NativeDiffState } from "./panel";
import type { ReviewState } from "./state/ReviewState";
import { SidebarReviewController } from "./state/SidebarReviewController";

const fileScheme = "branch-diff-review-file";

type BranchDiffNode =
  | BranchNode
  | SummaryNode
  | ErrorNode
  | FolderNode
  | FileNode;

interface BranchNode {
  type: "branch";
  branchType: "base" | "compare";
  value: string;
  current: boolean;
}

interface SummaryNode {
  type: "summary";
  label: string;
  description?: string;
}

interface ErrorNode {
  type: "error";
  message: string;
}

interface FolderNode {
  type: "folder";
  name: string;
  path: string;
  children: BranchDiffNode[];
}

interface FileNode {
  type: "file";
  name: string;
  file: DiffFileSummary;
}

const statusBadges: Record<FileStatus, string> = {
  added: "A",
  modified: "M",
  deleted: "D",
  renamed: "R",
  unknown: "?",
};

const statusLabels: Record<FileStatus, string> = {
  added: "Added",
  modified: "Modified",
  deleted: "Deleted",
  renamed: "Renamed",
  unknown: "Changed",
};

const statusColors: Partial<Record<FileStatus, string>> = {
  added: "gitDecoration.addedResourceForeground",
  modified: "gitDecoration.modifiedResourceForeground",
  deleted: "gitDecoration.deletedResourceForeground",
  renamed: "gitDecoration.renamedResourceForeground",
};

export class BranchDiffView
  implements
    vscode.TreeDataProvider<BranchDiffNode>,
    vscode.FileDecorationProvider
{
  public static readonly viewId = "branchDiffReview.sidebar";

  private readonly changedEmitter = new vscode.EventEmitter<
    BranchDiffNode | undefined
  >();
  private readonly controller: SidebarReviewController;
  private readonly decorationRegistration: vscode.Disposable;
  private state: ReviewState = { status: "idle" };
  private readonly treeView: vscode.TreeView<BranchDiffNode>;

  public readonly onDidChangeTreeData = this.changedEmitter.event;

  public constructor(
    gitBackend: GitBackend,
    publishDiff: (state: NativeDiffState) => void | Promise<void>,
  ) {
    this.treeView = vscode.window.createTreeView(BranchDiffView.viewId, {
      treeDataProvider: this,
      showCollapseAll: true,
    });
    this.decorationRegistration =
      vscode.window.registerFileDecorationProvider(this);
    this.controller = new SidebarReviewController(
      gitBackend,
      (state) => this.update(state),
      publishDiff,
    );
    this.updateMessage();
  }

  public async startReview(context: RepositoryContext): Promise<void> {
    await this.controller.start(context);
  }

  public async selectFile(comparisonId: string, path: string): Promise<void> {
    await this.controller.selectFile(comparisonId, path);
  }

  public async selectBase(): Promise<void> {
    await this.selectBranch("base");
  }

  public async selectCompare(): Promise<void> {
    await this.selectBranch("compare");
  }

  public getTreeItem(node: BranchDiffNode): vscode.TreeItem {
    if (node.type === "branch") {
      const label = node.branchType === "base" ? "Base" : "Compare";
      const item = new vscode.TreeItem(label);
      item.id = `branch:${node.branchType}`;
      item.description = `${node.current ? "• " : ""}${node.value}`;
      item.iconPath = new vscode.ThemeIcon(
        node.branchType === "base" ? "git-branch" : "git-compare",
      );
      item.command = {
        command:
          node.branchType === "base"
            ? "branchDiffReview.selectBase"
            : "branchDiffReview.selectCompare",
        title: `Select ${label} Branch`,
      };
      return item;
    }

    if (node.type === "summary") {
      const item = new vscode.TreeItem(node.label);
      item.id = "summary";
      item.description = node.description;
      item.iconPath = new vscode.ThemeIcon("diff");
      return item;
    }

    if (node.type === "error") {
      const item = new vscode.TreeItem("Comparison failed");
      item.id = "error";
      item.description = node.message;
      item.tooltip = node.message;
      item.iconPath = new vscode.ThemeIcon(
        "error",
        new vscode.ThemeColor("errorForeground"),
      );
      return item;
    }

    if (node.type === "folder") {
      const item = new vscode.TreeItem(
        node.name,
        vscode.TreeItemCollapsibleState.Expanded,
      );
      item.id = `folder:${node.path}`;
      item.iconPath = vscode.ThemeIcon.Folder;
      return item;
    }

    const item = new vscode.TreeItem(node.name);
    item.id = `file:${node.file.path}`;
    item.description = describeFile(node.file);
    item.tooltip = `${statusLabels[node.file.status]} · ${node.file.path}`;
    item.resourceUri = vscode.Uri.from({
      scheme: fileScheme,
      authority: node.file.status,
      path: `/${node.file.path}`,
    });

    if (this.state.status === "ready") {
      item.command = {
        command: "branchDiffReview.selectFile",
        title: "Open File Diff",
        arguments: [this.state.comparison.id, node.file.path],
      };
    }

    return item;
  }

  public getChildren(node?: BranchDiffNode): BranchDiffNode[] {
    if (node?.type === "folder") {
      return node.children;
    }
    if (node) {
      return [];
    }
    if (this.state.status === "idle") {
      return [];
    }

    const branches = this.branchNodes(this.state);
    if (this.state.status === "loading") {
      return [...branches, { type: "summary", label: "Comparing branches…" }];
    }
    if (this.state.status === "error") {
      return [...branches, { type: "error", message: this.state.message }];
    }

    const totals = this.state.comparison.totals;
    const summary: SummaryNode = {
      type: "summary",
      label: `${totals.files} changed ${totals.files === 1 ? "file" : "files"}`,
      description: `+${totals.additions} -${totals.deletions}`,
    };
    return [
      ...branches,
      summary,
      ...buildFileNodes(this.state.comparison.files),
    ];
  }

  public provideFileDecoration(
    uri: vscode.Uri,
  ): vscode.ProviderResult<vscode.FileDecoration> {
    if (uri.scheme !== fileScheme || !(uri.authority in statusBadges)) {
      return undefined;
    }
    const status = uri.authority as FileStatus;
    const color = statusColors[status];
    return new vscode.FileDecoration(
      statusBadges[status],
      statusLabels[status],
      color ? new vscode.ThemeColor(color) : undefined,
    );
  }

  public dispose(): void {
    this.changedEmitter.dispose();
    this.decorationRegistration.dispose();
    this.treeView.dispose();
  }

  private update(state: ReviewState): void {
    this.state = state;
    this.updateMessage();
    this.changedEmitter.fire(undefined);
  }

  private updateMessage(): void {
    this.treeView.message =
      this.state.status === "idle"
        ? "Run Open Branch Diff Review to compare branches."
        : undefined;
  }

  private branchNodes(
    state: Exclude<ReviewState, { status: "idle" }>,
  ): BranchNode[] {
    const currentBranch = state.branches.find((branch) => branch.current)?.name;
    return [
      {
        type: "branch",
        branchType: "base",
        value: state.baseRef,
        current: state.baseRef === currentBranch,
      },
      {
        type: "branch",
        branchType: "compare",
        value: state.headRef,
        current: state.headRef === currentBranch,
      },
    ];
  }

  private async selectBranch(branchType: "base" | "compare"): Promise<void> {
    const state = this.state;
    if (state.status === "idle") {
      return;
    }

    const currentValue = branchType === "base" ? state.baseRef : state.headRef;
    const selection = await vscode.window.showQuickPick(
      state.branches.map((branch) => branchItem(branch, currentValue)),
      {
        placeHolder: `Select ${branchType} branch`,
        matchOnDescription: true,
      },
    );
    if (!selection) {
      return;
    }

    await this.controller.selectBranches(
      branchType === "base" ? selection.label : state.baseRef,
      branchType === "compare" ? selection.label : state.headRef,
    );
  }
}

function branchItem(
  branch: BranchRef,
  currentValue: string,
): vscode.QuickPickItem {
  return {
    label: branch.name,
    description: branch.current ? "Current branch" : undefined,
    picked: branch.name === currentValue,
  };
}

function buildFileNodes(files: DiffFileSummary[]): BranchDiffNode[] {
  const root: FolderNode = {
    type: "folder",
    name: "",
    path: "",
    children: [],
  };

  for (const file of files) {
    const parts = file.path.split("/");
    const name = parts.pop();
    if (!name) {
      continue;
    }

    let folder = root;
    for (const part of parts) {
      const path = folder.path ? `${folder.path}/${part}` : part;
      let child = folder.children.find(
        (candidate): candidate is FolderNode =>
          candidate.type === "folder" && candidate.name === part,
      );
      if (!child) {
        child = { type: "folder", name: part, path, children: [] };
        folder.children.push(child);
      }
      folder = child;
    }
    folder.children.push({ type: "file", name, file });
  }

  sortNodes(root.children);
  return root.children;
}

function sortNodes(nodes: BranchDiffNode[]): void {
  nodes.sort((left, right) => {
    if (left.type !== right.type) {
      if (left.type === "folder") {
        return -1;
      }
      if (right.type === "folder") {
        return 1;
      }
    }
    return nodeName(left).localeCompare(nodeName(right));
  });
  for (const node of nodes) {
    if (node.type === "folder") {
      sortNodes(node.children);
    }
  }
}

function nodeName(node: BranchDiffNode): string {
  if (node.type === "folder" || node.type === "file") {
    return node.name;
  }
  return "";
}

function describeFile(file: DiffFileSummary): string {
  if (file.isBinary) {
    return "Binary";
  }
  const additions = file.additions ? `+${file.additions}` : "";
  const deletions = file.deletions ? `-${file.deletions}` : "";
  return [additions, deletions].filter(Boolean).join(" ");
}
