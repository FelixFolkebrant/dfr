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
