import type {
  ComparisonInput,
  ComparisonSummary,
  DiffFileSummary,
  FileDiffInput,
  FileDiffResult,
  FileStatus,
  ReviewCommit,
  ReviewDetails,
} from "./GitBackend";
import type { GitRunner } from "./GitRunner";

interface Numstat {
  additions?: number;
  deletions?: number;
  isBinary: boolean;
}

export class DiffService {
  public constructor(private readonly gitRunner: GitRunner) {}

  public async getReviewDetails(
    input: ComparisonInput,
  ): Promise<ReviewDetails> {
    const mergeBase = await this.findMergeBase(input);

    try {
      const log = await this.gitRunner.run(input.repoRoot, [
        "log",
        "--reverse",
        "--topo-order",
        "--format=%x1e%H%x1f%h%x1f%P%x1f%s%x1f%B%x1f",
        "--numstat",
        `${mergeBase}..${input.headRef}`,
      ]);
      const commits = parseCommitLog(log.stdout);
      return {
        mergeBase,
        commits,
      };
    } catch (error) {
      throw new Error(
        `Could not load review details for ${input.headRef}: ${errorMessage(error)}`,
      );
    }
  }

  public async getComparisonSummary(
    input: ComparisonInput,
  ): Promise<ComparisonSummary> {
    const mergeBase = input.mergeBase ?? (await this.findMergeBase(input));
    const diffBaseRef = input.diffBaseRef ?? mergeBase;
    const diffHeadRef = input.diffHeadRef ?? input.headRef;

    try {
      const [nameStatus, numstat] = await Promise.all([
        this.gitRunner.run(input.repoRoot, [
          "diff",
          "--find-renames",
          "--name-status",
          "-z",
          diffBaseRef,
          diffHeadRef,
        ]),
        this.gitRunner.run(input.repoRoot, [
          "diff",
          "--find-renames",
          "--numstat",
          "-z",
          diffBaseRef,
          diffHeadRef,
        ]),
      ]);
      const files = combineDiffOutput(nameStatus.stdout, numstat.stdout);

      return {
        id: `${diffBaseRef}:${diffHeadRef}`,
        ...input,
        mergeBase,
        diffBaseRef,
        diffHeadRef,
        files,
        totals: {
          files: files.length,
          additions: files.reduce(
            (total, file) => total + (file.additions ?? 0),
            0,
          ),
          deletions: files.reduce(
            (total, file) => total + (file.deletions ?? 0),
            0,
          ),
        },
      };
    } catch (error) {
      throw new Error(
        `Could not compare ${diffHeadRef} with ${diffBaseRef}: ${errorMessage(error)}`,
      );
    }
  }

  public async getFileDiff(input: FileDiffInput): Promise<FileDiffResult> {
    try {
      const [baseContent, headContent] = await Promise.all([
        input.status === "added"
          ? ""
          : this.readFile(
              input.repoRoot,
              input.diffBaseRef ?? input.mergeBase,
              input.oldPath ?? input.path,
            ),
        input.status === "deleted"
          ? ""
          : this.readFile(
              input.repoRoot,
              input.diffHeadRef ?? input.headRef,
              input.path,
            ),
      ]);
      return {
        path: input.path,
        ...(input.oldPath ? { oldPath: input.oldPath } : {}),
        baseContent,
        headContent,
      };
    } catch (error) {
      throw new Error(
        `Could not load ${input.path} between ${input.diffBaseRef ?? input.mergeBase} and ${input.diffHeadRef ?? input.headRef}: ${errorMessage(error)}`,
      );
    }
  }

  private async readFile(
    repoRoot: string,
    ref: string,
    path: string,
  ): Promise<string> {
    const { stdout } = await this.gitRunner.run(repoRoot, [
      "show",
      `${ref}:${path}`,
    ]);
    return stdout;
  }

  private async findMergeBase(input: ComparisonInput): Promise<string> {
    try {
      const { stdout } = await this.gitRunner.run(input.repoRoot, [
        "merge-base",
        input.baseRef,
        input.headRef,
      ]);
      const mergeBase = stdout.trim();
      if (!mergeBase) {
        throw new Error("Git returned an empty merge base");
      }
      return mergeBase;
    } catch (error) {
      throw new Error(
        `Could not find a merge base between ${input.baseRef} and ${input.headRef}: ${errorMessage(error)}`,
      );
    }
  }
}

export function parseCommitLog(output: string): ReviewCommit[] {
  return output
    .split("\x1e")
    .filter((record) => record.trim())
    .map((record) => {
      const [sha, shortSha, parents, subject, message = "", numstat = ""] =
        record.replace(/^\n/, "").split("\x1f");
      const parentSha = parents?.split(" ")[0];
      if (!sha || !shortSha || !parentSha || subject === undefined) {
        throw new Error("Malformed Git commit log output");
      }
      const stats = parseCommitNumstat(numstat);
      return {
        sha,
        shortSha,
        parentSha,
        subject,
        message: message.trim(),
        ...stats,
      };
    });
}

function parseCommitNumstat(output: string): {
  filesChanged: number;
  additions: number;
  deletions: number;
} {
  return output.split("\n").reduce(
    (totals, line) => {
      const [additions, deletions, path] = line.trim().split("\t");
      if (!path) return totals;
      totals.filesChanged += 1;
      if (additions !== "-") totals.additions += Number(additions);
      if (deletions !== "-") totals.deletions += Number(deletions);
      return totals;
    },
    { filesChanged: 0, additions: 0, deletions: 0 },
  );
}

export function combineDiffOutput(
  nameStatusOutput: string,
  numstatOutput: string,
): DiffFileSummary[] {
  const stats = parseNumstat(numstatOutput);

  return parseNameStatus(nameStatusOutput).map((file) => ({
    ...file,
    ...(stats.get(file.path) ?? { isBinary: false }),
  }));
}

export function parseNameStatus(
  output: string,
): Omit<DiffFileSummary, "additions" | "deletions" | "isBinary">[] {
  const tokens = nulTokens(output);
  const files: Omit<DiffFileSummary, "additions" | "deletions" | "isBinary">[] =
    [];

  for (let index = 0; index < tokens.length; ) {
    const code = tokens[index++];
    const firstPath = tokens[index++];
    if (!code || !firstPath) {
      throw new Error("Malformed Git name-status output");
    }

    if (code.startsWith("R") || code.startsWith("C")) {
      const path = tokens[index++];
      if (!path) {
        throw new Error("Malformed Git rename output");
      }
      files.push({ path, oldPath: firstPath, status: "renamed" });
      continue;
    }

    files.push({ path: firstPath, status: fileStatus(code) });
  }

  return files;
}

function parseNumstat(output: string): Map<string, Numstat> {
  const tokens = nulTokens(output, true);
  const stats = new Map<string, Numstat>();

  for (let index = 0; index < tokens.length; ) {
    const record = tokens[index++];
    if (!record) {
      break;
    }
    const [additions, deletions, inlinePath] = record.split("\t");
    if (
      additions === undefined ||
      deletions === undefined ||
      inlinePath === undefined
    ) {
      throw new Error("Malformed Git numstat output");
    }

    let path = inlinePath;
    if (!path) {
      const oldPath = tokens[index++];
      path = tokens[index++];
      if (!oldPath || !path) {
        throw new Error("Malformed Git rename numstat output");
      }
    }

    const isBinary = additions === "-" || deletions === "-";
    stats.set(path, {
      additions: isBinary ? undefined : parseCount(additions),
      deletions: isBinary ? undefined : parseCount(deletions),
      isBinary,
    });
  }

  return stats;
}

function fileStatus(code: string): FileStatus {
  switch (code[0]) {
    case "A":
      return "added";
    case "M":
      return "modified";
    case "D":
      return "deleted";
    default:
      return "unknown";
  }
}

function parseCount(value: string): number {
  const count = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error(`Invalid Git numstat count: ${value}`);
  }
  return count;
}

function nulTokens(output: string, preserveEmpty = false): string[] {
  const tokens = output.split("\0");
  if (tokens.at(-1) === "") {
    tokens.pop();
  }
  return preserveEmpty ? tokens : tokens.filter(Boolean);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
