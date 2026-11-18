import type { GitBackend, Repository, RepositoryContext } from "./GitBackend";

export async function getRepositoryContext(
  backend: GitBackend,
  selected?: Repository,
): Promise<RepositoryContext | null | undefined> {
  const repositories = selected ? [selected] : await backend.getRepositories();
  if (repositories.length === 0) {
    return null;
  }

  const repository = selected ?? (await backend.chooseRepository(repositories));
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
