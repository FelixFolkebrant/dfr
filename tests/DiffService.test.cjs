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

test("loads one text patch from the merge base", async () => {
  const calls = [];
  const runner = {
    async run(cwd, args) {
      calls.push([cwd, args]);
      return args[0] === "merge-base"
        ? { stdout: "abc123\n", stderr: "" }
        : { stdout: "diff --git a/file.ts b/file.ts\n+changed\n", stderr: "" };
    },
  };

  const result = await new DiffService(runner).getFilePatch({
    repoRoot: "/repo",
    baseRef: "main",
    headRef: "feature",
    path: "file.ts",
  });

  assert.deepEqual(result, {
    path: "file.ts",
    patch: "diff --git a/file.ts b/file.ts\n+changed\n",
    isBinary: false,
  });
  assert.deepEqual(calls[1], [
    "/repo",
    [
      "diff",
      "--find-renames",
      "--no-ext-diff",
      "--no-textconv",
      "--unified=80",
      "abc123",
      "feature",
      "--",
      "file.ts",
    ],
  ]);
});

test("retains both rename paths when loading a patch", async () => {
  const calls = [];
  const runner = {
    async run(_cwd, args) {
      calls.push(args);
      return args[0] === "merge-base"
        ? { stdout: "abc123\n", stderr: "" }
        : { stdout: "similarity index 100%\n", stderr: "" };
    },
  };

  const result = await new DiffService(runner).getFilePatch({
    repoRoot: "/repo",
    baseRef: "main",
    headRef: "feature",
    oldPath: "old.ts",
    path: "new.ts",
  });

  assert.equal(result.oldPath, "old.ts");
  assert.deepEqual(calls[1].slice(-3), ["--", "old.ts", "new.ts"]);
});

test("identifies a binary patch without returning patch text", async () => {
  const runner = {
    async run(_cwd, args) {
      return args[0] === "merge-base"
        ? { stdout: "abc123\n", stderr: "" }
        : {
            stdout:
              "diff --git a/image.png b/image.png\nBinary files a/image.png and b/image.png differ\n",
            stderr: "",
          };
    },
  };

  const result = await new DiffService(runner).getFilePatch({
    repoRoot: "/repo",
    baseRef: "main",
    headRef: "feature",
    path: "image.png",
  });

  assert.deepEqual(result, {
    path: "image.png",
    patch: undefined,
    isBinary: true,
  });
});

test("reports empty selected-file patches with comparison context", async () => {
  const runner = {
    async run(_cwd, args) {
      return args[0] === "merge-base"
        ? { stdout: "abc123\n", stderr: "" }
        : { stdout: "", stderr: "" };
    },
  };

  await assert.rejects(
    () =>
      new DiffService(runner).getFilePatch({
        repoRoot: "/repo",
        baseRef: "main",
        headRef: "feature",
        path: "missing.ts",
      }),
    /Could not load the patch for missing\.ts between merge base abc123 and feature: Git returned no patch/,
  );
});
