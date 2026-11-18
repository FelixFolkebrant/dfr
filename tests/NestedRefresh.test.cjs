const assert = require("node:assert/strict");
const Module = require("node:module");
const { test } = require("node:test");

const commands = new Map();
const pending = [];
const progress = [];
const rootUri = { path: "/workspace", scheme: "file", authority: "" };
const nested = {
  rootUri: { path: "/workspace/repo", scheme: "file", authority: "" },
};
let provider;
class Backend {
  async getRepositories() {
    return [nested];
  }
  async findNestedRepositories() {
    return [nested];
  }
  async openRepository() {}
}
class Sidebar {
  static viewId = "branchDiffReview.sidebar";
  constructor(_uri, _backend, _publish, select) {
    this.select = select;
    provider = this;
  }
  async showNoRepository(repos) {
    this.state = repos;
  }
  async startReview(context) {
    this.state = context.repository;
  }
}
const vscode = {
  ExtensionMode: { Development: 2 },
  workspace: {
    workspaceFolders: [{ uri: rootUri }],
    fs: { readDirectory: async () => [] },
    asRelativePath: () => "repo",
  },
  commands: {
    registerCommand: (name, callback) => {
      commands.set(name, callback);
      return {};
    },
  },
  window: {
    registerWebviewViewProvider: () => ({}),
    withProgress: (options, run) => {
      progress.push(options);
      const result = run();
      pending.push(result);
      return result;
    },
    showErrorMessage: (message) => {
      throw new Error(message);
    },
  },
};
const originalLoad = Module._load;
let activate;
try {
  Module._load = function (id, ...args) {
    if (id === "vscode") return vscode;
    if (id === "./git/NativeGitBackend") return { NativeGitBackend: Backend };
    if (id === "./git/getRepositoryContext")
      return {
        getRepositoryContext: async (_backend, repository) => ({ repository }),
      };
    if (id === "./sidebar") return { BranchDiffSidebarProvider: Sidebar };
    if (id === "./panel")
      return {
        NativeDiffView: class {
          update() {}
        },
      };
    return originalLoad.call(this, id, ...args);
  };
  ({ activate } = require("../dist/extension"));
} finally {
  Module._load = originalLoad;
}

test("refresh returns a selected nested repository to the picker with native progress", async () => {
  activate({ extensionMode: 1, extensionUri: {}, subscriptions: [] });
  await pending[0];
  assert.deepEqual(provider.state, ["repo"]);
  await provider.select("repo");
  assert.equal(provider.state, nested);
  await commands.get("branchDiffReview.refresh")();
  assert.deepEqual(provider.state, ["repo"]);
  assert.deepEqual(
    progress,
    Array(3).fill({ location: { viewId: "branchDiffReview.sidebar" } }),
  );
});
