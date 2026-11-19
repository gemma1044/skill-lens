import { readFile } from "node:fs/promises";

import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import type {
  OpenAIUiResourceMetadata,
  OpenAIUiToolMetadata,
} from "@openai/mcp-extensions/server";
import { z } from "zod/v4";

import { readSkill, scanSkills } from "./skills.js";

const UI_URI = "ui://skill-lens/global-v1";
const icons = [
  {
    src: `data:image/svg+xml,${encodeURIComponent(
      await readFile(new URL("../assets/icon.svg", import.meta.url), "utf8"),
    )}`,
    mimeType: "image/svg+xml",
    sizes: ["any"],
  },
];
const readonly = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
};

function result(data: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data) }],
    structuredContent: data,
  };
}

function currentSessionIds(extra?: unknown): string[] {
  const metadata = (extra as { _meta?: Record<string, unknown> } | undefined)?._meta;
  const openAiSession = metadata?.["openai/session"];
  return [...new Set([
    process.env.CODEX_THREAD_ID,
    typeof openAiSession === "string" ? openAiSession : undefined,
  ].filter((value): value is string => Boolean(value)))];
}

serveStdio(async () => {
  const server = new McpServer({
    name: "skill-lens",
    title: "Skill Lens",
    version: "0.1.3",
    icons,
  });
  const html = await readFile(new URL("./app.html", import.meta.url), "utf8");

  server.registerResource("skill-lens-app", UI_URI, { mimeType: RESOURCE_MIME_TYPE }, async () => ({
    contents: [
      {
        uri: UI_URI,
        mimeType: RESOURCE_MIME_TYPE,
        text: html,
        _meta: {
          "openai/ui": {
            preferredDisplayMode: "fullscreen",
            availableDisplayModes: ["fullscreen", "inline"],
          } satisfies OpenAIUiResourceMetadata,
        },
      },
    ],
  }));

  server.registerTool(
    "skillLens.open",
    {
      title: "Skill Lens",
      description: "Display the current session's observed Skills in the Skill Lens app. This app-only entrypoint is not a conversational search tool.",
      inputSchema: z.object({}),
      icons,
      annotations: readonly,
      _meta: {
        ui: { resourceUri: UI_URI, visibility: ["app"] },
        "openai/ui": {
          entrypoints: [{ type: "global" }, { type: "thread" }],
        } satisfies OpenAIUiToolMetadata,
        "openai/iconStyle": "monochrome",
      },
    },
    async (_args, extra) => result({ snapshot: await scanSkills({ sessionIds: currentSessionIds(extra) }) }),
  );

  server.registerTool(
    "skillLens.list",
    {
      title: "Refresh skills",
      description: "Rescan local Skill directories and recent observed reads.",
      inputSchema: z.object({}),
      annotations: readonly,
      _meta: { ui: { visibility: ["app"] } },
    },
    async (_args, extra) => result({ snapshot: await scanSkills({ sessionIds: currentSessionIds(extra) }) }),
  );

  server.registerTool(
    "skillLens.read",
    {
      title: "Read Skill instructions",
      description: "Read the exact SKILL.md content for one discovered Skill.",
      inputSchema: z.object({ path: z.string() }),
      annotations: readonly,
      _meta: { ui: { visibility: ["app"] } },
    },
    async ({ path }, extra) => {
      const snapshot = await scanSkills({ sessionIds: currentSessionIds(extra) });
      return result({ detail: await readSkill(path, snapshot) });
    },
  );

  return server;
});
