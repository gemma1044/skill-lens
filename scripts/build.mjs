import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { build } from "esbuild";

const root = process.cwd();
const dist = path.join(root, "dist");
const appOut = path.join(dist, ".app");
await rm(dist, { recursive: true, force: true });
await mkdir(appOut, { recursive: true });

await build({
  entryPoints: ["src/app/index.ts"],
  bundle: true,
  format: "esm",
  platform: "browser",
  outdir: appOut,
  minify: true,
});

const template = await readFile("src/app/index.html", "utf8");
const javascript = await readFile(path.join(appOut, "index.js"), "utf8");
const css = await readFile(path.join(appOut, "index.css"), "utf8");
const inlineJavascript = javascript.replace(/<\/script/gi, "<\\/script");
const composeHtml = (preview) => template.replace(
  "</head>",
  () => `<style>${css}</style>${preview ? "<script>window.__SKILL_LENS_PREVIEW__={apiBase:location.origin};</script>" : ""}</head>`,
).replace(
  "</body>",
  () => `<script type="module">${inlineJavascript}</script></body>`,
);

const appHtml = composeHtml(false);
const previewHtml = composeHtml(true);
for (const [name, html, expectedScriptClosings] of [
  ["app.html", appHtml, 1],
  ["preview.html", previewHtml, 2],
]) {
  const doctypes = html.match(/<!doctype html>/gi)?.length ?? 0;
  const scriptClosings = html.match(/<\/script/gi)?.length ?? 0;
  if (doctypes !== 1 || scriptClosings !== expectedScriptClosings) {
    throw new Error(`${name} failed inline HTML integrity check`);
  }
}

await Promise.all([
  writeFile(path.join(dist, "app.html"), appHtml),
  writeFile(path.join(dist, "preview.html"), previewHtml),
  build({
    entryPoints: ["src/server/index.ts"],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile: path.join(dist, "server.js"),
  }),
]);
await rm(appOut, { recursive: true, force: true });
