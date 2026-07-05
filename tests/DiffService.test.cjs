const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  DiffService,
  combineDiffOutput,
  extractIssueKeys,
  findRelatedDocuments,
  parseCommitLog,
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
    /Could not load missing\.ts between abc123 and feature: missing blob/,
  );
});

test("parses oldest-first commit metadata", () => {
  const output = [
    "\x1eaaaaaaaa\x1faaaaaaa\x1fparent-a\x1fIS-010: first\x1fIS-010: first\n\nBody\x1f\n\n12\t3\tsrc/one.ts\n-\t-\timage.png\n",
    "\x1ebbbbbbbb\x1fbbbbbbb\x1fparent-b parent-2\x1fIS-010: second\x1fIS-010: second\x1f\n\n4\t0\tsrc/two.ts\n",
  ].join("\n");

  assert.deepEqual(parseCommitLog(output), [
    {
      sha: "aaaaaaaa",
      shortSha: "aaaaaaa",
      parentSha: "parent-a",
      subject: "IS-010: first",
      message: "IS-010: first\n\nBody",
      filesChanged: 2,
      additions: 12,
      deletions: 3,
    },
    {
      sha: "bbbbbbbb",
      shortSha: "bbbbbbb",
      parentSha: "parent-b",
      subject: "IS-010: second",
      message: "IS-010: second",
      filesChanged: 1,
      additions: 4,
      deletions: 0,
    },
  ]);
});

test("normalizes issue keys without crossing namespaces", () => {
  assert.deepEqual(extractIssueKeys("user/GH-001/work for #02 and gl_3"), [
    { namespace: "GH", number: 1 },
    { namespace: "#", number: 2 },
    { namespace: "GL", number: 3 },
  ]);

  assert.deepEqual(
    findRelatedDocuments(
      "user/GH-1/work",
      [{ subject: "Also addresses #2" }, { subject: "GL-003: follow-up" }],
      [
        "docs/GH-001-PLAN.md",
        "docs/GH-10.md",
        "docs/GL-003.md",
        "docs/IS-001.md",
        "notes/#002.review.markdown",
        "notes/random-GH-1.md",
      ],
    ),
    ["docs/GH-001-PLAN.md", "docs/GL-003.md", "notes/#002.review.markdown"],
  );
});

test("loads review commits and matching tracked Markdown documents", async () => {
  const calls = [];
  const runner = {
    async run(_cwd, args) {
      calls.push(args);
      if (args[0] === "merge-base") {
        return { stdout: "base123\n", stderr: "" };
      }
      if (args[0] === "log") {
        return {
          stdout:
            "\x1ecommit1\x1fcomm1\x1fbase123\x1fGH-001: change\x1fGH-001: change\x1f\n\n2\t1\tsrc/file.ts\n",
          stderr: "",
        };
      }
      return {
        stdout: "docs/GH-1-PLAN.md\0docs/GL-001.md\0src/file.ts\0",
        stderr: "",
      };
    },
  };

  const details = await new DiffService(runner).getReviewDetails({
    repoRoot: "/repo",
    baseRef: "main",
    headRef: "feature/GH-001",
  });

  assert.equal(details.mergeBase, "base123");
  assert.equal(details.commits[0].sha, "commit1");
  assert.deepEqual(
    {
      filesChanged: details.commits[0].filesChanged,
      additions: details.commits[0].additions,
      deletions: details.commits[0].deletions,
    },
    { filesChanged: 1, additions: 2, deletions: 1 },
  );
  assert.deepEqual(details.documents, ["docs/GH-1-PLAN.md"]);
  assert.deepEqual(calls[1].slice(0, 3), ["log", "--reverse", "--topo-order"]);
  assert.equal(calls[1].includes("--numstat"), true);
  assert.deepEqual(calls[2], ["ls-files", "-z"]);
});

test("uses an explicit parent-to-commit range", async () => {
  const calls = [];
  const runner = {
    async run(_cwd, args) {
      calls.push(args);
      return args.includes("--name-status")
        ? { stdout: "M\0file.ts\0", stderr: "" }
        : { stdout: "1\t1\tfile.ts\0", stderr: "" };
    },
  };

  const result = await new DiffService(runner).getComparisonSummary({
    repoRoot: "/repo",
    baseRef: "main",
    headRef: "feature",
    mergeBase: "branch-base",
    diffBaseRef: "parent",
    diffHeadRef: "commit",
  });

  assert.equal(result.id, "parent:commit");
  assert.equal(result.mergeBase, "branch-base");
  assert.equal(
    calls.some((args) => args[0] === "merge-base"),
    false,
  );
  assert.equal(
    calls.every((args) => args.includes("parent") && args.includes("commit")),
    true,
  );
});
