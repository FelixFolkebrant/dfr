const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs/promises");
const Module = require("node:module");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const uri = (fsPath) => ({ fsPath, toString: () => fsPath });
const vscode = {
  FileType: { Directory: 2 },
  Uri: { joinPath: (base, name) => uri(path.join(base.fsPath, name)) },
  workspace: {
    workspaceFolders: [],
    fs: {
      async readDirectory(directory) {
        const entries = await fs.readdir(directory.fsPath, {
          withFileTypes: true,
        });
        return entries.map((entry) => [
          entry.name,
          entry.isSymbolicLink() ? 66 : entry.isDirectory() ? 2 : 1,
        ]);
      },
    },
  },
};
const originalLoad = Module._load;
let NativeGitBackend;
try {
  Module._load = function (id, ...args) {
    return id === "vscode" ? vscode : originalLoad.call(this, id, ...args);
  };
  ({ NativeGitBackend } = require("../dist/git/NativeGitBackend"));
} finally {
  Module._load = originalLoad;
}

test("finds real nested repositories and ignores empty .git directories and symlinks", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "dfr-repos-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const valid = path.join(root, "group", "repo");
  const invalid = path.join(root, "empty");
  await fs.mkdir(valid, { recursive: true });
  await fs.mkdir(path.join(invalid, ".git"), { recursive: true });
  execFileSync("git", ["init", "-q", valid]);
  await fs.symlink(valid, path.join(root, "link"));
  vscode.workspace.workspaceFolders = [{ uri: uri(root) }];
  const backend = new NativeGitBackend();
  assert.equal(await backend.isRepositoryRoot(uri(invalid)), false);
  assert.equal(await backend.isRepositoryRoot(uri(valid)), true);
  const repositories = await backend.findNestedRepositories();
  assert.deepEqual(
    repositories.map(({ rootUri }) => rootUri.fsPath),
    [valid],
  );
});
