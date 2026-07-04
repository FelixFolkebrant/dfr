const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const { test } = require("node:test");
const path = require("node:path");

test("starts review automatically and contributes refresh", async () => {
  const packageJson = require("../package.json");
  const refreshCommand = packageJson.contributes.commands.find(
    (command) => command.command === "branchDiffReview.refresh",
  );
  const titleMenu = packageJson.contributes.menus["view/title"].find(
    (item) => item.command === "branchDiffReview.refresh",
  );
  const extensionSource = await readFile(
    path.join(__dirname, "../src/extension.ts"),
    "utf8",
  );

  assert.deepEqual(refreshCommand, {
    command: "branchDiffReview.refresh",
    title: "Refresh Branch Diff Review",
    category: "Branch Diff Review",
    icon: "$(refresh)",
  });
  assert.deepEqual(titleMenu, {
    command: "branchDiffReview.refresh",
    when: "view == branchDiffReview.sidebar",
    group: "navigation",
  });
  assert.match(
    extensionSource,
    /registerCommand\(refreshCommand,[\s\S]*sidebarProvider\.refreshReview/,
  );
  assert.match(
    extensionSource,
    /void discoverAndRun\(gitBackend, "start",[\s\S]*sidebarProvider\.startReview/,
  );
  assert.equal(
    packageJson.contributes.commands.some(
      (command) => command.command === "branchDiffReview.open",
    ),
    false,
  );
});
