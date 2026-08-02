const assert = require("node:assert/strict");
const { test } = require("node:test");

const { parseMergedBranches, parseNumstat } = require("../dist/git/history.js");

test("parses first-parent merge history and merged branch names", () => {
  const output = [
    "\x1emerge1\x1fm1\x1fbase1 head1\x1fMerge pull request #12 from owner/feature/one",
    "\x1emerge2\x1fm2\x1fbase2 head2\x1fMerge branch 'release'",
  ].join("\n");

  assert.deepEqual(parseMergedBranches(output), [
    {
      mergeSha: "merge1",
      shortSha: "m1",
      baseSha: "base1",
      headSha: "head1",
      name: "feature/one",
      subject: "Merge pull request #12 from owner/feature/one",
      title: "Merge pull request #12 from owner/feature/one",
      commitCount: 0,
      additions: 0,
      deletions: 0,
    },
    {
      mergeSha: "merge2",
      shortSha: "m2",
      baseSha: "base2",
      headSha: "head2",
      name: "release",
      subject: "Merge branch 'release'",
      title: "Merge branch 'release'",
      commitCount: 0,
      additions: 0,
      deletions: 0,
    },
  ]);
});

test("totals text changes while ignoring binary files", () => {
  assert.deepEqual(
    parseNumstat("12\t3\tsrc/one.ts\n4\t0\tsrc/two.ts\n-\t-\timage.png\n"),
    { additions: 16, deletions: 3 },
  );
});

test("parses merged branch line totals", () => {
  const [branch] = parseMergedBranches(
    "\x1emerge1\x1fm1\x1fbase1 head1\x1fMerge branch 'feature'\x1f\n\n12\t3\tone.ts\n4\t0\ttwo.ts\n",
  );

  assert.deepEqual(
    { additions: branch.additions, deletions: branch.deletions },
    { additions: 16, deletions: 3 },
  );
});

test("rejects non-merge log records", () => {
  assert.throws(
    () => parseMergedBranches("\x1esha\x1fshort\x1fone-parent\x1fSubject"),
    /Malformed Git merge log output/,
  );
});
