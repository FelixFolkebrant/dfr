const assert = require("node:assert/strict");
const Module = require("node:module");
const { test } = require("node:test");

const contexts = new Map();
const clipboard = [];
const notifications = [];
const vscode = {
  Uri: { joinPath: (...parts) => parts.join("/") },
  commands: {
    async executeCommand(command, key, value) {
      assert.equal(command, "setContext");
      contexts.set(key, value);
    },
  },
  env: {
    clipboard: {
      async writeText(text) {
        clipboard.push(text);
      },
    },
  },
  window: { setStatusBarMessage: (...args) => notifications.push(args) },
};
const originalLoad = Module._load;
let BranchDiffSidebarProvider;
try {
  Module._load = function (id, ...args) {
    return id === "vscode" ? vscode : originalLoad.call(this, id, ...args);
  };
  ({ BranchDiffSidebarProvider } = require("../dist/sidebar.js"));
} finally {
  Module._load = originalLoad;
}

const commits = [
  { sha: "oldest", parentSha: "base" },
  { sha: "newest", parentSha: "oldest" },
];
const branches = [{ name: "feature", current: true }, { name: "main" }];
const context = {
  repository: { rootUri: { fsPath: "/repo" } },
  currentBranch: branches[0],
  defaultBase: branches[1],
  branches,
};

function setup(reviewCommits = commits) {
  contexts.clear();
  clipboard.length = 0;
  notifications.length = 0;
  const messages = [];
  let receive;
  let dispose;
  let fail = false;
  let pause;
  const backend = {
    async getReviewDetails() {
      return { mergeBase: "base", commits: reviewCommits };
    },
    async getComparisonSummary(input) {
      if (pause) await pause;
      if (fail) throw new Error("Comparison failed");
      return {
        id: `${input.diffBaseRef ?? "base"}:${input.diffHeadRef ?? "feature"}`,
        ...input,
        mergeBase: "base",
        files: [],
        totals: { files: 0, additions: 0, deletions: 0 },
      };
    },
  };
  const provider = new BranchDiffSidebarProvider(
    "/extension",
    backend,
    () => {},
  );
  provider.resolveWebviewView({
    webview: {
      asWebviewUri: (uri) => uri,
      postMessage: async (message) => {
        messages.push(message);
        return true;
      },
      onDidReceiveMessage: (handler) => {
        receive = handler;
        return { dispose() {} };
      },
    },
    onDidDispose: (handler) => {
      dispose = handler;
    },
  });
  return {
    provider,
    messages,
    receive: (message) => receive(message),
    dispose: () => dispose(),
    selected: () =>
      messages.findLast((message) => message.type === "state").state
        .selectedCommitSha,
    fail: () => {
      fail = true;
    },
    pause: (promise) => {
      pause = promise;
    },
  };
}

test("title navigation cycles through commits and all changes in both directions", async () => {
  const view = setup();
  await view.receive({ type: "ready" });
  await view.provider.startReview(context);
  assert.equal(contexts.get("branchDiffReview.canNavigate"), true);
  assert.equal(contexts.get("branchDiffReview.canCopyHash"), false);
  for (const expected of ["newest", "oldest", undefined]) {
    await view.provider.runAction("previousCommit");
    assert.equal(view.selected(), expected);
  }
  for (const expected of ["oldest", "newest", undefined]) {
    await view.provider.runAction("nextCommit");
    assert.equal(view.selected(), expected);
  }
});

test("copy uses the full selected hash and confirms it in the status bar", async () => {
  const view = setup();
  await view.receive({ type: "ready" });
  await view.provider.startReview(context);
  await view.provider.runAction("copyHash");
  assert.deepEqual(clipboard, []);
  await view.provider.runAction("nextCommit");
  assert.equal(contexts.get("branchDiffReview.canCopyHash"), true);
  await view.provider.runAction("copyHash");
  assert.deepEqual(clipboard, ["oldest"]);
  assert.deepEqual(notifications, [["DFR: Commit hash copied", 1000]]);
});

test("History and Settings reach the webview and publish their open state", async () => {
  const view = setup();
  await view.receive({ type: "ready" });
  await view.provider.startReview(context);
  for (const action of ["toggleHistory", "toggleSettings"]) {
    await view.provider.runAction(action);
    assert.deepEqual(view.messages.at(-1), { type: "action", action });
  }
  await view.receive({
    type: "toolbarState",
    historyOpen: true,
    settingsOpen: false,
  });
  assert.equal(contexts.get("branchDiffReview.historyOpen"), true);
  assert.equal(contexts.get("branchDiffReview.settingsOpen"), false);
  await view.receive({
    type: "toolbarState",
    historyOpen: false,
    settingsOpen: true,
  });
  assert.equal(contexts.get("branchDiffReview.historyOpen"), false);
  assert.equal(contexts.get("branchDiffReview.settingsOpen"), true);
  view.dispose();
  assert.equal(contexts.get("branchDiffReview.sidebarReady"), false);
  assert.equal(contexts.get("branchDiffReview.settingsOpen"), false);
});

test("navigation and copy are disabled before mount, while loading, and on errors", async () => {
  const view = setup();
  await view.provider.startReview(context);
  await view.provider.runAction("nextCommit");
  assert.equal(view.selected(), undefined);
  assert.equal(contexts.get("branchDiffReview.canNavigate"), false);
  await view.receive({ type: "ready" });
  let resume;
  view.pause(
    new Promise((resolve) => {
      resume = resolve;
    }),
  );
  const loading = view.provider.runAction("nextCommit");
  assert.equal(contexts.get("branchDiffReview.canNavigate"), false);
  assert.equal(contexts.get("branchDiffReview.canCopyHash"), false);
  await view.provider.runAction("copyHash");
  assert.deepEqual(clipboard, []);
  resume();
  await loading;
  view.fail();
  await view.provider.runAction("nextCommit");
  assert.equal(contexts.get("branchDiffReview.canNavigate"), false);
  assert.equal(contexts.get("branchDiffReview.canCopyHash"), false);
  assert.equal(contexts.get("branchDiffReview.sidebarReady"), true);
});

test("an empty comparison leaves navigation and copy disabled", async () => {
  const view = setup([]);
  await view.receive({ type: "ready" });
  await view.provider.startReview(context);
  assert.equal(contexts.get("branchDiffReview.canNavigate"), false);
  assert.equal(contexts.get("branchDiffReview.canCopyHash"), false);
  await view.provider.runAction("nextCommit");
  assert.equal(view.selected(), undefined);
});

test("open panels replace their title actions with a Close icon and tooltip", async () => {
  const view = setup();
  await view.receive({ type: "ready" });
  await view.provider.startReview(context);
  const manifest = require("../package.json");
  const visibleActions = () =>
    manifest.contributes.menus["view/title"]
      .filter((item) =>
        item.when.split(" && ").every((condition) => {
          if (condition === "view == branchDiffReview.sidebar") return true;
          const negated = condition.startsWith("!");
          const value = contexts.get(negated ? condition.slice(1) : condition);
          return negated ? !value : !!value;
        }),
      )
      .map((item) =>
        manifest.contributes.commands.find(
          (command) => command.command === item.command,
        ),
      );
  for (const [
    historyOpen,
    settingsOpen,
    openCommand,
    closeCommand,
    closeTitle,
  ] of [
    [true, false, "toggleHistory", "closeHistory", "DFR: Close history"],
    [
      false,
      true,
      "toggleSettings",
      "closeSettings",
      "DFR: Close comparison settings",
    ],
  ]) {
    await view.receive({ type: "toolbarState", historyOpen, settingsOpen });
    const visible = visibleActions();
    assert.equal(visible.length, 6);
    assert.equal(
      visible.some(
        (command) => command.command === `branchDiffReview.${openCommand}`,
      ),
      false,
    );
    const close = visible.find(
      (command) => command.command === `branchDiffReview.${closeCommand}`,
    );
    assert.equal(close.title, closeTitle);
    assert.equal(close.icon, "$(close)");
  }
  await view.receive({
    type: "toolbarState",
    historyOpen: false,
    settingsOpen: false,
  });
  assert.deepEqual(
    visibleActions().map((command) => command.command),
    [
      "branchDiffReview.refresh",
      "branchDiffReview.previousCommit",
      "branchDiffReview.nextCommit",
      "branchDiffReview.toggleHistory",
      "branchDiffReview.copyHash",
      "branchDiffReview.toggleSettings",
    ],
  );
  assert.equal(
    manifest.contributes.commands.some((command) => "toggled" in command),
    false,
  );
});
