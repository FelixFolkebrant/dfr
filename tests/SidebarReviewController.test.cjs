const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  SidebarReviewController,
} = require("../dist/state/SidebarReviewController.js");

const branches = [
  { name: "feature", kind: "local", current: true },
  { name: "main", kind: "local", current: false },
  { name: "other", kind: "local", current: false },
];

const context = {
  repository: { rootUri: { fsPath: "/repo" } },
  currentBranch: branches[0],
  branches,
  defaultBase: branches[1],
};

function summary(baseRef, headRef, files = 1) {
  return {
    id: `${baseRef}:${headRef}`,
    repoRoot: "/repo",
    baseRef,
    headRef,
    mergeBase: "abc123",
    files: files
      ? [
          {
            path: "file.ts",
            status: "modified",
            additions: 4,
            deletions: 2,
            isBinary: false,
          },
        ]
      : [],
    totals: { files, additions: files ? 4 : 0, deletions: files ? 2 : 0 },
  };
}

test("publishes initial loading and comparison states", async () => {
  const requests = [];
  const states = [];
  const backend = {
    async getComparisonSummary(input) {
      requests.push(input);
      return summary(input.baseRef, input.headRef);
    },
  };
  const controller = new SidebarReviewController(backend, (state) => {
    states.push(state);
  });

  await controller.start(context);

  assert.deepEqual(requests, [
    { repoRoot: "/repo", baseRef: "main", headRef: "feature" },
  ]);
  assert.equal(states[0].status, "loading");
  assert.equal(states[1].status, "ready");
  assert.deepEqual(states[1].comparison.totals, {
    files: 1,
    additions: 4,
    deletions: 2,
  });
});

test("publishes actionable comparison errors and keeps the selection", async () => {
  const states = [];
  const backend = {
    async getComparisonSummary() {
      throw new Error("Could not find a merge base between main and feature");
    },
  };
  const controller = new SidebarReviewController(backend, (state) => {
    states.push(state);
  });

  await controller.start(context);

  assert.equal(states.at(-1).status, "error");
  assert.equal(states.at(-1).baseRef, "main");
  assert.equal(states.at(-1).headRef, "feature");
  assert.match(states.at(-1).message, /merge base between main and feature/);
});

test("ignores unknown branch-selection requests", async () => {
  let requestCount = 0;
  const backend = {
    async getComparisonSummary(input) {
      requestCount += 1;
      return summary(input.baseRef, input.headRef);
    },
  };
  const controller = new SidebarReviewController(backend, () => {});
  await controller.start(context);

  await controller.selectBranches("missing", "feature");

  assert.equal(requestCount, 1);
  assert.equal(controller.getState().baseRef, "main");
});

test("prevents a stale comparison from replacing a newer selection", async () => {
  const pending = new Map();
  const backend = {
    getComparisonSummary(input) {
      return new Promise((resolve) => pending.set(input.baseRef, resolve));
    },
  };
  const controller = new SidebarReviewController(backend, () => {});

  const initial = controller.start(context);
  const newer = controller.selectBranches("other", "feature");
  await Promise.resolve();
  pending.get("other")(summary("other", "feature", 0));
  await newer;
  pending.get("main")(summary("main", "feature"));
  await initial;

  const state = controller.getState();
  assert.equal(state.status, "ready");
  assert.equal(state.baseRef, "other");
  assert.equal(state.comparison.totals.files, 0);
});

test("publishes a selected file from the active comparison", async () => {
  const states = [];
  const backend = {
    async getComparisonSummary(input) {
      return summary(input.baseRef, input.headRef);
    },
  };
  const controller = new SidebarReviewController(backend, (state) => {
    states.push(state);
  });
  await controller.start(context);

  await controller.selectFile("main:feature", "file.ts");

  assert.equal(controller.getState().selectedPath, "file.ts");
  assert.equal(states.at(-1).selectedPath, "file.ts");
});

test("ignores stale comparisons and paths outside the active summary", async () => {
  let publishCount = 0;
  const backend = {
    async getComparisonSummary(input) {
      return summary(input.baseRef, input.headRef);
    },
  };
  const controller = new SidebarReviewController(backend, () => {
    publishCount += 1;
  });
  await controller.start(context);

  await controller.selectFile("other:feature", "file.ts");
  await controller.selectFile("main:feature", "missing.ts");

  assert.equal(controller.getState().selectedPath, undefined);
  assert.equal(publishCount, 2);
});
