import { readFile, writeFile } from "node:fs/promises";

import { createVSIX } from "@vscode/vsce";

const manifest = JSON.parse(await readFile("package.json", "utf8"));
let readme = await readFile("README.md", "utf8");
const images = new Set(
  [...readme.matchAll(/(?:src|srcset)="(media\/[^"]+\.png)"/g)].map(
    (match) => match[1],
  ),
);

// Extension details only allow HTTPS and data images, even for local installs.
for (const image of images) {
  const data = await readFile(image);
  readme = readme.replaceAll(
    image,
    `data:image/png;base64,${data.toString("base64")}`,
  );
}

readme = readme.replace(/href="(docs\/[^"]+|LICENSE)"/g, (_, path) => {
  const repository = manifest.repository.url.replace(/\.git$/, "");
  return `href="${repository}/blob/HEAD/${path}"`;
});
await writeFile("dist/readme.md", readme);

await createVSIX({
  dependencies: false,
  packagePath: "dfr.vsix",
  readmePath: "dist/readme.md",
  rewriteRelativeLinks: false,
});
