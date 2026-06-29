const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  buildChangedFileTree,
  flattenChangedFileTree,
  getFolderPaths,
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
