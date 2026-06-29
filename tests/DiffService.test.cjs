const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  DiffService,
  combineDiffOutput,
  parseNameStatus,
} = require("../dist/git/DiffService.js");

test("parses statuses and rename paths", () => {
  assert.deepEqual(
    parseNameStatus(
      "A\0added.ts\0M\0changed.ts\0D\0deleted.ts\0R091\0old.ts\0new.ts\0X\0odd.ts\0",
    ),
    [
      { path: "added.ts", status: "added" },
      { path: "changed.ts", status: "modified" },
      { path: "deleted.ts", status: "deleted" },
      { path: "new.ts", oldPath: "old.ts", status: "renamed" },
      { path: "odd.ts", status: "unknown" },
    ],
  );
});

test("combines numstat counts, renames, and binary markers", () => {
  const files = combineDiffOutput(
    "M\0text.ts\0R100\0old.ts\0new.ts\0A\0image.png\0",
    [
      "12\t3\ttext.ts",
      "0\t0\t",
      "old.ts",
      "new.ts",
      "-\t-\timage.png",
      "",
    ].join("\0"),
  );

  assert.deepEqual(files, [
    {
      path: "text.ts",
      status: "modified",
      additions: 12,
      deletions: 3,
      isBinary: false,
    },
    {
      path: "new.ts",
      oldPath: "old.ts",
      status: "renamed",
      additions: 0,
      deletions: 0,
      isBinary: false,
    },
    {
      path: "image.png",
      status: "added",
      additions: undefined,
      deletions: undefined,
      isBinary: true,
    },
  ]);
});

test("runs merge-base before summary diffs and totals numeric changes", async () => {
  const calls = [];
  const runner = {
    async run(cwd, args) {
      calls.push([cwd, args]);
      if (args[0] === "merge-base") {
        return { stdout: "abc123\n", stderr: "" };
      }
      if (args.includes("--name-status")) {
        return { stdout: "M\0src/file.ts\0A\0asset.bin\0", stderr: "" };
      }
      return {
        stdout: ["4\t2\tsrc/file.ts", "-\t-\tasset.bin", ""].join("\0"),
        stderr: "",
      };
    },
  };

  const summary = await new DiffService(runner).getComparisonSummary({
    repoRoot: "/repo",
    baseRef: "main",
    headRef: "feature",
  });

  assert.equal(summary.mergeBase, "abc123");
  assert.deepEqual(summary.totals, { files: 2, additions: 4, deletions: 2 });
  assert.deepEqual(calls[0], ["/repo", ["merge-base", "main", "feature"]]);
  assert.equal(calls[1][1].includes("abc123"), true);
  assert.equal(calls[2][1].includes("abc123"), true);
});

test("reports merge-base failures with both refs", async () => {
  const runner = {
    async run() {
      throw new Error("not a valid object");
    },
  };

  await assert.rejects(
    () =>
      new DiffService(runner).getComparisonSummary({
        repoRoot: "/repo",
        baseRef: "missing-base",
        headRef: "feature",
      }),
    /Could not find a merge base between missing-base and feature/,
  );
});

test("loads both file versions for the native diff editor", async () => {
  const calls = [];
  const runner = {
    async run(cwd, args) {
      calls.push([cwd, args]);
      return {
        stdout: args[1].startsWith("abc123:") ? "before\n" : "after\n",
        stderr: "",
      };
    },
  };

  const result = await new DiffService(runner).getFileDiff({
    repoRoot: "/repo",
    baseRef: "main",
    headRef: "feature",
    mergeBase: "abc123",
    path: "file.ts",
    status: "modified",
  });

  assert.deepEqual(result, {
    path: "file.ts",
    baseContent: "before\n",
    headContent: "after\n",
  });
  assert.deepEqual(calls, [
    ["/repo", ["show", "abc123:file.ts"]],
    ["/repo", ["show", "feature:file.ts"]],
  ]);
});

test("loads the old and new paths for a rename", async () => {
  const calls = [];
  const runner = {
    async run(_cwd, args) {
      calls.push(args);
      return { stdout: args[1], stderr: "" };
    },
  };

  const result = await new DiffService(runner).getFileDiff({
    repoRoot: "/repo",
    baseRef: "main",
    headRef: "feature",
    mergeBase: "abc123",
    oldPath: "old.ts",
    path: "new.ts",
    status: "renamed",
  });

  assert.equal(result.oldPath, "old.ts");
  assert.deepEqual(calls, [
    ["show", "abc123:old.ts"],
    ["show", "feature:new.ts"],
  ]);
});

test("uses an empty document for an added or deleted side", async () => {
  const calls = [];
  const runner = {
    async run(_cwd, args) {
      calls.push(args);
      return { stdout: "content\n", stderr: "" };
    },
  };
  const service = new DiffService(runner);

  const added = await service.getFileDiff({
    repoRoot: "/repo",
    baseRef: "main",
    headRef: "feature",
    mergeBase: "abc123",
    path: "added.ts",
    status: "added",
  });
  const deleted = await service.getFileDiff({
    repoRoot: "/repo",
    baseRef: "main",
    headRef: "feature",
    mergeBase: "abc123",
    path: "deleted.ts",
    status: "deleted",
  });

  assert.equal(added.baseContent, "");
  assert.equal(added.headContent, "content\n");
  assert.equal(deleted.baseContent, "content\n");
  assert.equal(deleted.headContent, "");
  assert.deepEqual(calls, [
    ["show", "feature:added.ts"],
    ["show", "abc123:deleted.ts"],
  ]);
});

test("reports selected-file content failures with comparison context", async () => {
  const runner = {
    async run(_cwd, args) {
      if (args[1].startsWith("abc123:")) {
        throw new Error("missing blob");
      }
      return { stdout: "content", stderr: "" };
    },
  };

  await assert.rejects(
    () =>
      new DiffService(runner).getFileDiff({
        repoRoot: "/repo",
        baseRef: "main",
        headRef: "feature",
        mergeBase: "abc123",
        path: "missing.ts",
        status: "modified",
      }),
    /Could not load missing\.ts between merge base abc123 and feature: missing blob/,
  );
});
