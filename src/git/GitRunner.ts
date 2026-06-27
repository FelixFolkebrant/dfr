import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface GitResult {
  stdout: string;
  stderr: string;
}

export class GitRunner {
  public async run(cwd: string, args: readonly string[]): Promise<GitResult> {
    const result = await execFileAsync("git", args, {
      cwd,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
    });

    return {
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }
}
