const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  buildChangedFileTree,
  buildContextualFileTree,
  flattenChangedFileTree,
  flattenChangedFiles,
  getFolderPaths,
  getFolderChangeSummary,
  getChangedAncestorPaths,
} = require("../dist/webviews/fileTree.js");

const files = [
  {
    path: "README.md",
    status: "modified",
    additions: 2,
    deletions: 1,
    isBinary: false,
  },
  {
    path: "src/z.ts",
    status: "deleted",
    additions: 0,
    deletions: 4,
    isBinary: false,
  },
  {
    path: "src/components/Button.tsx",
    status: "added",
    additions: 12,
    deletions: 0,
    isBinary: false,
  },
  {
    path: "src/a.ts",
    status: "renamed",
    additions: 1,
    deletions: 1,
    isBinary: false,
  },
];

test("groups changed files into sorted folders", () => {
  const tree = buildChangedFileTree(files);

  assert.deepEqual(
    tree.map((node) => [node.kind, node.path]),
    [
      ["folder", "src"],
      ["file", "README.md"],
    ],
  );
  assert.deepEqual(
    tree[0].children.map((node) => [node.kind, node.path]),
    [
      ["folder", "src/components"],
      ["file", "src/a.ts"],
      ["file", "src/z.ts"],
    ],
  );
  assert.equal(tree[0].children[0].children[0].file, files[2]);
});

test("flattens directories into collapsible groups", () => {
  assert.deepEqual(
    flattenChangedFiles(files, new Set(["src", "src/components"])).map(
      ({ level, node }) => [
        level,
        node.kind,
        node.name,
        node.parentPath,
        node.path,
      ],
    ),
    [
      [1, "file", "README.md", undefined, "README.md"],
      [1, "folder", "src", undefined, "src"],
      [2, "file", "a.ts", "src", "src/a.ts"],
      [2, "file", "z.ts", "src", "src/z.ts"],
      [1, "folder", "src/components", undefined, "src/components"],
      [2, "file", "Button.tsx", "src/components", "src/components/Button.tsx"],
    ],
  );

  assert.deepEqual(
    flattenChangedFiles(files, new Set(["src/components"])).map(
      ({ node }) => node.path,
    ),
    ["README.md", "src", "src/components", "src/components/Button.tsx"],
  );
});

test("builds repository context and identifies changed ancestors", () => {
  const tree = buildContextualFileTree(
    ["docs/guide.md", "src/a.ts", "src/components/Button.tsx"],
    files,
  );

  assert.deepEqual(
    tree.map((node) => [node.kind, node.path]),
    [
      ["folder", "docs"],
      ["folder", "src"],
      ["file", "README.md"],
    ],
  );
  assert.equal(tree[0].children[0].file, undefined);
  assert.equal(
    tree[1].children.find((node) => node.path === "src/a.ts").file,
    files[3],
  );
  assert.deepEqual(getChangedAncestorPaths(files), ["src", "src/components"]);
});

test("collects folders and flattens only expanded paths", () => {
  const tree = buildChangedFileTree(files);

  assert.deepEqual(getFolderPaths(tree), ["src", "src/components"]);
  assert.deepEqual(
    flattenChangedFileTree(tree, new Set(["src"])).map(({ level, node }) => [
      level,
      node.path,
    ]),
    [
      [1, "src"],
      [2, "src/components"],
      [2, "src/a.ts"],
      [2, "src/z.ts"],
      [1, "README.md"],
    ],
  );
});

test("summarizes changed descendants for collapsed folders", () => {
  const tree = buildContextualFileTree(
    ["src/a.ts", "src/components/Button.tsx", "src/unchanged.ts"],
    files,
  );
  const src = tree.find((node) => node.path === "src");
  const components = src.children.find(
    (node) => node.path === "src/components",
  );

  assert.deepEqual(getFolderChangeSummary(src), {
    additions: 13,
    deletions: 5,
    files: 3,
  });
  assert.deepEqual(getFolderChangeSummary(components), {
    additions: 12,
    deletions: 0,
    files: 1,
  });
});
