import { execFile } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import esbuild from "esbuild";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const outputRoot = path.join(root, "dist", "webview");

const bundles = [
  {
    entry: path.join(root, "webview", "sidebar", "main.tsx"),
    outfile: path.join(outputRoot, "sidebar.js"),
  },
  {
    entry: path.join(root, "webview", "diff-panel", "main.tsx"),
    outfile: path.join(outputRoot, "diff-panel.js"),
  },
];

const styles = [
  {
    input: path.join(root, "webview", "sidebar", "styles.css"),
    output: path.join(outputRoot, "sidebar.css"),
  },
  {
    input: path.join(root, "webview", "diff-panel", "styles.css"),
    output: path.join(outputRoot, "diff-panel.css"),
  },
];

await rm(outputRoot, { force: true, recursive: true });
await mkdir(outputRoot, { recursive: true });

for (const bundle of bundles) {
  await esbuild.build({
    bundle: true,
    entryPoints: [bundle.entry],
    format: "esm",
    minify: false,
    outfile: bundle.outfile,
    platform: "browser",
    sourcemap: false,
    target: "es2022",
  });
}

for (const style of styles) {
  await execFileAsync("pnpm", [
    "exec",
    "tailwindcss",
    "-i",
    style.input,
    "-o",
    style.output,
  ]);
}
