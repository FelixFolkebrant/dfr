const assert = require("node:assert/strict");
const { test } = require("node:test");
const { getRepositoryContext } = require("../dist/git/getRepositoryContext");

test("reports an empty repository list without an error", async () => {
  assert.equal(
    await getRepositoryContext({ getRepositories: async () => [] }),
    null,
  );
});

test("distinguishes cancelling repository selection from no repositories", async () => {
  assert.equal(
    await getRepositoryContext({
      getRepositories: async () => [{ rootUri: {} }],
      chooseRepository: async () => undefined,
    }),
    undefined,
  );
});
