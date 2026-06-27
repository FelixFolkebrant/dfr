const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  MAX_RENDERED_PATCH_BYTES,
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
    async getFilePatch(input) {
      return {
        path: input.path,
        patch: "diff --git a/file.ts b/file.ts\n+changed\n",
        isBinary: false,
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
    patch: "diff --git a/file.ts b/file.ts\n+changed\n",
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
    async getFilePatch(input) {
      requests.push(input);
      return {
        path: input.path,
        oldPath: input.oldPath,
        patch: "diff --git a/old.ts b/new.ts\n",
        isBinary: false,
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
      path: "new.ts",
      oldPath: "old.ts",
    },
  ]);
});

test("publishes binary, oversized, and patch-loading error states", async () => {
  const panelStates = [];
  let result = { path: "file.ts", isBinary: true };
  const backend = {
    async getComparisonSummary(input) {
      return summary(input.baseRef, input.headRef);
    },
    async getFilePatch() {
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

  await controller.selectBranches("other", "feature");
  result = {
    path: "file.ts",
    isBinary: false,
    patch: "x".repeat(MAX_RENDERED_PATCH_BYTES + 1),
  };
  await controller.selectFile("other:feature", "file.ts");
  assert.deepEqual(
    {
      status: panelStates.at(-1).status,
      bytes: panelStates.at(-1).bytes,
      maxBytes: panelStates.at(-1).maxBytes,
    },
    {
      status: "tooLarge",
      bytes: MAX_RENDERED_PATCH_BYTES + 1,
      maxBytes: MAX_RENDERED_PATCH_BYTES,
    },
  );

  await controller.selectBranches("main", "feature");
  result = new Error("patch failed");
  await controller.selectFile("main:feature", "file.ts");
  assert.equal(panelStates.at(-1).status, "error");
  assert.match(panelStates.at(-1).message, /patch failed/);
});

test("ignores superseded patches and clears the panel on branch changes", async () => {
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
    getFilePatch(input) {
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
    patch: "diff --git a/second.ts b/second.ts\n+new\n",
    isBinary: false,
  });
  await second;
  pending.get("file.ts")({
    path: "file.ts",
    patch: "diff --git a/file.ts b/file.ts\n+old\n",
    isBinary: false,
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
