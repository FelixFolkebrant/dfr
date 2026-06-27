import type {
  ComparisonInput,
  ComparisonSummary,
  DiffFileSummary,
  FileStatus,
} from "./GitBackend";
import type { GitRunner } from "./GitRunner";

interface Numstat {
  additions?: number;
  deletions?: number;
  isBinary: boolean;
}

export class DiffService {
  public constructor(private readonly gitRunner: GitRunner) {}

  public async getComparisonSummary(
    input: ComparisonInput,
  ): Promise<ComparisonSummary> {
    const mergeBase = await this.findMergeBase(input);

    try {
      const [nameStatus, numstat] = await Promise.all([
        this.gitRunner.run(input.repoRoot, [
          "diff",
          "--find-renames",
          "--name-status",
          "-z",
          mergeBase,
          input.headRef,
        ]),
        this.gitRunner.run(input.repoRoot, [
          "diff",
          "--find-renames",
          "--numstat",
          "-z",
          mergeBase,
          input.headRef,
        ]),
      ]);
      const files = combineDiffOutput(nameStatus.stdout, numstat.stdout);

      return {
        id: `${mergeBase}:${input.headRef}`,
        ...input,
        mergeBase,
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
        `Could not compare ${input.headRef} with merge base ${mergeBase}: ${errorMessage(error)}`,
      );
    }
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
