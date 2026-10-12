const assert = require("node:assert/strict");
const { test } = require("node:test");

const { isSidebarMessage } = require("../dist/webviews/protocol.js");

test("validates sidebar review messages", () => {
  const valid = [
    { type: "ready" },
    { type: "toolbarState", historyOpen: true, settingsOpen: false },
    { type: "selectCommit" },
    { type: "selectCommit", sha: "abc123" },
    { type: "selectHistory" },
    { type: "selectHistory", mergeSha: "merge123" },
    { type: "selectBranches", baseRef: "main", headRef: "feature" },
    { type: "selectFile", comparisonId: "base:head", path: "file.ts" },
  ];
  const invalid = [
    undefined,
    {},
    { type: "toolbarState", historyOpen: true },
    { type: "toolbarState", historyOpen: "true", settingsOpen: false },
    { type: "selectCommit", sha: 123 },
    { type: "selectHistory", mergeSha: 123 },
    { type: "selectBranches", baseRef: "main" },
    { type: "selectFile", comparisonId: "base:head" },
  ];

  assert.equal(valid.every(isSidebarMessage), true);
  assert.equal(invalid.some(isSidebarMessage), false);
});
