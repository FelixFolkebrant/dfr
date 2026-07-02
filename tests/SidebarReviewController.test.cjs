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
  await new Promise((resolve) => setImmediate(resolve));
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
  const panelStates = [];
  const backend = {
    async getComparisonSummary(input) {
      return summary(input.baseRef, input.headRef);
    },
    async getFileDiff(input) {
      return {
        path: input.path,
        baseContent: "before\n",
        headContent: "after\n",
      };
    },
  };
  const controller = new SidebarReviewController(
    backend,
    (state) => states.push(state),
    (state) => panelStates.push(state),
  );
  await controller.start(context);

  await controller.selectFile("main:feature", "file.ts");

  assert.equal(controller.getState().selectedPath, "file.ts");
  assert.equal(states.at(-1).selectedPath, "file.ts");
  assert.equal(panelStates.at(-2).status, "loading");
  assert.deepEqual(panelStates.at(-1), {
    status: "ready",
    comparisonId: "main:feature",
    baseRef: "main",
    headRef: "feature",
    path: "file.ts",
    baseContent: "before\n",
    headContent: "after\n",
  });
});

test("loads renamed files with both paths", async () => {
  const requests = [];
  const renamedSummary = summary("main", "feature");
  renamedSummary.files[0] = {
    ...renamedSummary.files[0],
    path: "new.ts",
    oldPath: "old.ts",
    status: "renamed",
  };
  const backend = {
    async getComparisonSummary() {
      return renamedSummary;
    },
    async getFileDiff(input) {
      requests.push(input);
      return {
        path: input.path,
        oldPath: input.oldPath,
        baseContent: "before\n",
        headContent: "after\n",
      };
    },
  };
  const controller = new SidebarReviewController(backend, () => {});
  await controller.start(context);

  await controller.selectFile("main:feature", "new.ts");

  assert.deepEqual(requests, [
    {
      repoRoot: "/repo",
      baseRef: "main",
      headRef: "feature",
      mergeBase: "abc123",
      path: "new.ts",
      oldPath: "old.ts",
      status: "renamed",
    },
  ]);
});

test("publishes binary and file-loading error states", async () => {
  const panelStates = [];
  let isBinary = true;
  let result = { path: "file.ts", baseContent: "before", headContent: "after" };
  const backend = {
    async getComparisonSummary(input) {
      const value = summary(input.baseRef, input.headRef);
      value.files[0].isBinary = isBinary;
      return value;
    },
    async getFileDiff() {
      if (result instanceof Error) {
        throw result;
      }
      return result;
    },
  };
  const controller = new SidebarReviewController(
    backend,
    () => {},
    (state) => panelStates.push(state),
  );
  await controller.start(context);
  await controller.selectFile("main:feature", "file.ts");
  assert.equal(panelStates.at(-1).status, "binary");

  isBinary = false;
  await controller.selectBranches("other", "feature");
  result = new Error("file loading failed");
  await controller.selectFile("other:feature", "file.ts");
  assert.equal(panelStates.at(-1).status, "error");
  assert.match(panelStates.at(-1).message, /file loading failed/);
});

test("ignores superseded file loads and clears native diffs on branch changes", async () => {
  const panelStates = [];
  const pending = new Map();
  const twoFileSummary = summary("main", "feature");
  twoFileSummary.files.push({
    path: "second.ts",
    status: "added",
    additions: 1,
    deletions: 0,
    isBinary: false,
  });
  twoFileSummary.totals.files = 2;
  const backend = {
    async getComparisonSummary(input) {
      return {
        ...twoFileSummary,
        id: `${input.baseRef}:${input.headRef}`,
        baseRef: input.baseRef,
        headRef: input.headRef,
      };
    },
    getFileDiff(input) {
      return new Promise((resolve) => pending.set(input.path, resolve));
    },
  };
  const controller = new SidebarReviewController(
    backend,
    () => {},
    (state) => panelStates.push(state),
  );
  await controller.start(context);

  const first = controller.selectFile("main:feature", "file.ts");
  await new Promise((resolve) => setImmediate(resolve));
  const second = controller.selectFile("main:feature", "second.ts");
  await new Promise((resolve) => setImmediate(resolve));
  pending.get("second.ts")({
    path: "second.ts",
    baseContent: "",
    headContent: "new\n",
  });
  await second;
  pending.get("file.ts")({
    path: "file.ts",
    baseContent: "before\n",
    headContent: "old\n",
  });
  await first;

  assert.equal(panelStates.at(-1).status, "ready");
  assert.equal(panelStates.at(-1).path, "second.ts");

  await controller.selectBranches("other", "feature");
  assert.deepEqual(panelStates.at(-1), {
    status: "noSelection",
    baseRef: "other",
    headRef: "feature",
  });
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

test("refresh preserves selected refs when both still exist", async () => {
  const requests = [];
  const refreshedBranches = [
    { name: "next", kind: "local", current: true },
    ...branches,
  ];
  const refreshedContext = {
    ...context,
    currentBranch: refreshedBranches[0],
    branches: refreshedBranches,
  };
  const backend = {
    async getComparisonSummary(input) {
      requests.push(input);
      return summary(input.baseRef, input.headRef);
    },
  };
  const controller = new SidebarReviewController(backend, () => {});
  await controller.start(context);
  await controller.selectBranches("other", "feature");

  await controller.refresh(refreshedContext);

  assert.deepEqual(requests.at(-1), {
    repoRoot: "/repo",
    baseRef: "other",
    headRef: "feature",
  });
  assert.equal(controller.getState().branches, refreshedBranches);
});

test("refresh resets both refs when either selected ref is missing", async () => {
  const requests = [];
  const missingHeadBranches = [
    { name: "next", kind: "local", current: true },
    { name: "develop", kind: "local", current: false },
    branches[2],
  ];
  const missingHeadContext = {
    ...context,
    currentBranch: missingHeadBranches[0],
    branches: missingHeadBranches,
    defaultBase: missingHeadBranches[1],
  };
  const backend = {
    async getComparisonSummary(input) {
      requests.push(input);
      return summary(input.baseRef, input.headRef);
    },
  };
  const controller = new SidebarReviewController(backend, () => {});
  await controller.start(context);
  await controller.selectBranches("other", "feature");

  await controller.refresh(missingHeadContext);

  assert.deepEqual(requests.at(-1), {
    repoRoot: "/repo",
    baseRef: "develop",
    headRef: "next",
  });

  const missingBaseBranches = [
    { name: "release", kind: "local", current: true },
    { name: "trunk", kind: "local", current: false },
    { name: "next", kind: "local", current: false },
  ];
  await controller.refresh({
    ...context,
    currentBranch: missingBaseBranches[0],
    branches: missingBaseBranches,
    defaultBase: missingBaseBranches[1],
  });

  assert.deepEqual(requests.at(-1), {
    repoRoot: "/repo",
    baseRef: "trunk",
    headRef: "release",
  });
});

test("refresh from idle starts the refreshed default comparison", async () => {
  const requests = [];
  const backend = {
    async getComparisonSummary(input) {
      requests.push(input);
      return summary(input.baseRef, input.headRef);
    },
  };
  const controller = new SidebarReviewController(backend, () => {});

  await controller.refresh(context);

  assert.deepEqual(requests, [
    { repoRoot: "/repo", baseRef: "main", headRef: "feature" },
  ]);
  assert.equal(controller.getState().status, "ready");
});

test("refresh clears file selection and supersedes its load", async () => {
  const states = [];
  const panelStates = [];
  let resolveFile;
  const backend = {
    async getComparisonSummary(input) {
      return summary(input.baseRef, input.headRef);
    },
    getFileDiff() {
      return new Promise((resolve) => {
        resolveFile = resolve;
      });
    },
  };
  const controller = new SidebarReviewController(
    backend,
    (state) => states.push(state),
    (state) => panelStates.push(state),
  );
  await controller.start(context);
  const fileLoad = controller.selectFile("main:feature", "file.ts");
  await new Promise((resolve) => setImmediate(resolve));

  await controller.refresh(context);
  resolveFile({
    path: "file.ts",
    baseContent: "before\n",
    headContent: "after\n",
  });
  await fileLoad;

  assert.equal(states.at(-1).selectedPath, undefined);
  assert.deepEqual(panelStates.at(-1), {
    status: "noSelection",
    baseRef: "main",
    headRef: "feature",
  });
  assert.equal(
    panelStates.filter((state) => state.status === "ready").length,
    0,
  );
});

test("older comparisons cannot replace a refreshed result", async () => {
  const pending = [];
  const backend = {
    getComparisonSummary(input) {
      return new Promise((resolve) => pending.push({ input, resolve }));
    },
  };
  const controller = new SidebarReviewController(backend, () => {});
  const initial = controller.start(context);
  await new Promise((resolve) => setImmediate(resolve));

  const refreshed = controller.refresh(context);
  await new Promise((resolve) => setImmediate(resolve));
  pending[1].resolve(summary("main", "feature", 0));
  await refreshed;
  pending[0].resolve(summary("main", "feature"));
  await initial;

  assert.equal(controller.getState().comparison.totals.files, 0);
});

test("refresh comparison failures use the existing error state", async () => {
  let shouldFail = false;
  const backend = {
    async getComparisonSummary(input) {
      if (shouldFail) {
        throw new Error("refreshed comparison failed");
      }
      return summary(input.baseRef, input.headRef);
    },
  };
  const controller = new SidebarReviewController(backend, () => {});
  await controller.start(context);
  shouldFail = true;

  await controller.refresh(context);

  assert.equal(controller.getState().status, "error");
  assert.match(controller.getState().message, /refreshed comparison failed/);
  assert.equal(controller.getState().baseRef, "main");
  assert.equal(controller.getState().headRef, "feature");
});
