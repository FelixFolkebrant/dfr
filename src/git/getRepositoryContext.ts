import type { GitBackend, RepositoryContext } from "./GitBackend";

export async function getRepositoryContext(
  backend: GitBackend,
): Promise<RepositoryContext | undefined> {
  const repositories = await backend.getRepositories();
  if (repositories.length === 0) {
    throw new Error("No open Git repository was found.");
  }

  const repository = await backend.chooseRepository(repositories);
  if (!repository) {
    return undefined;
  }

  const [currentBranch, branches] = await Promise.all([
    backend.getCurrentBranch(repository),
    backend.getBranches(repository),
  ]);
  const defaultBase = await backend.getDefaultBase(branches);

  return { repository, currentBranch, branches, defaultBase };
}
