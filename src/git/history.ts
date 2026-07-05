import type { MergedBranch } from "./GitBackend";

export function parseMergedBranches(output: string): MergedBranch[] {
  return output
    .split("\x1e")
    .filter((record) => record.trim())
    .map((record) => {
      const [mergeSha, shortSha, parents, subject, numstat = ""] = record
        .replace(/^\n/, "")
        .split("\x1f");
      const [baseSha, headSha] = parents?.split(" ") ?? [];
      if (!mergeSha || !shortSha || !baseSha || !headSha || !subject) {
        throw new Error("Malformed Git merge log output");
      }
      const cleanSubject = subject.trim();
      const totals = parseNumstat(numstat);
      return {
        mergeSha,
        shortSha,
        baseSha,
        headSha,
        name: mergedBranchName(cleanSubject),
        subject: cleanSubject,
        title: cleanSubject,
        commitCount: 0,
        ...totals,
      };
    });
}

export function parseNumstat(output: string): {
  additions: number;
  deletions: number;
} {
  return output.split("\n").reduce(
    (totals, line) => {
      const [additions, deletions] = line.split("\t");
      if (additions && additions !== "-") totals.additions += Number(additions);
      if (deletions && deletions !== "-") totals.deletions += Number(deletions);
      return totals;
    },
    { additions: 0, deletions: 0 },
  );
}

function mergedBranchName(subject: string): string {
  const pullRequestBranch = subject.match(/\sfrom\s+[^\s/]+\/(.+)$/)?.[1];
  if (pullRequestBranch) return pullRequestBranch;

  const namedBranch = subject.match(/^Merge branch ['"](.+?)['"]/)?.[1];
  return namedBranch ?? subject;
}
