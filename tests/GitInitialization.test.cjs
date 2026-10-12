const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  waitForGitInitialization,
} = require("../dist/git/waitForGitInitialization");

test("waits for the initial Git repository scan", async () => {
  let listener;
  let disposed = false;
  const api = {
    state: "uninitialized",
    onDidChangeState(nextListener) {
      listener = nextListener;
      return {
        dispose() {
          disposed = true;
        },
      };
    },
  };

  let initialized = false;
  const waiting = waitForGitInitialization(api).then(() => {
    initialized = true;
  });

  await Promise.resolve();
  assert.equal(initialized, false);
  assert.equal(disposed, false);

  listener("initialized");
  await waiting;

  assert.equal(initialized, true);
  assert.equal(disposed, true);
});

test("continues immediately when Git is already initialized", async () => {
  const api = {
    state: "initialized",
    onDidChangeState() {
      throw new Error("A listener should not be registered");
    },
  };

  await waitForGitInitialization(api);
});
