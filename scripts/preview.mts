import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { readSkill, scanSkills } from "../src/server/skills.ts";
import type { SkillSnapshot } from "../src/shared/contracts.ts";

const host = "127.0.0.1";
const port = Number(process.env.PORT ?? 4173);
const htmlPath = path.resolve("dist/preview.html");
let snapshot: SkillSnapshot | null = null;

createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${host}:${port}`);
    response.setHeader("Cache-Control", "no-store");
    if (url.pathname === "/api/snapshot") {
      snapshot = await scanSkills();
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.end(JSON.stringify({ snapshot }));
      return;
    }
    if (url.pathname === "/api/skill") {
      snapshot ??= await scanSkills();
      const skillPath = url.searchParams.get("path");
      if (!skillPath) throw new Error("Missing Skill path");
      const detail = await readSkill(skillPath, snapshot);
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.end(JSON.stringify({ detail }));
      return;
    }
    if (url.pathname === "/" || url.pathname === "/preview.html") {
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.end(await readFile(htmlPath));
      return;
    }
    response.statusCode = 404;
    response.end("Not found");
  } catch (error) {
    response.statusCode = 400;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
  }
}).listen(port, host, () => {
  process.stdout.write(`Skill Lens preview: http://${host}:${port}/preview.html\n`);
});
