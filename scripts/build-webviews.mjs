import { execFile } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import esbuild from "esbuild";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const outputRoot = path.join(root, "dist", "webview");

await rm(outputRoot, { force: true, recursive: true });
await mkdir(outputRoot, { recursive: true });

for (const surface of ["sidebar"]) {
  const sourceRoot = path.join(root, "webview", surface);

  await esbuild.build({
    bundle: true,
    entryPoints: [path.join(sourceRoot, "main.tsx")],
    format: "esm",
    jsx: "automatic",
    outfile: path.join(outputRoot, `${surface}.js`),
    platform: "browser",
    target: "es2022",
  });
  await execFileAsync("pnpm", [
    "exec",
    "tailwindcss",
    "-i",
    path.join(sourceRoot, "styles.css"),
    "-o",
    path.join(outputRoot, `${surface}.css`),
  ]);
}
