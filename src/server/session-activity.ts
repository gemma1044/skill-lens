import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";

import type { ActivityRecord } from "../shared/contracts.js";

const SKILL_PATH = /(?:file:\/\/)?([/~A-Za-z0-9_.+@%:=\\-][^"'\s]*?SKILL\.md)/gi;
const MAX_SESSION_SEARCH_DEPTH = 5;
const revisionCache = new Map<string, { signature: string; revision: string }>();

function defaultSessionsRoot(): string {
  const codexHome = process.env.CODEX_HOME;
  return path.join(codexHome ? path.resolve(codexHome) : path.join(os.homedir(), ".codex"), "sessions");
}

export async function findSessionFile(root: string, sessionId: string, depth = 0): Promise<string | null> {
  if (depth > MAX_SESSION_SEARCH_DEPTH) return null;
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".jsonl") && entry.name.includes(sessionId)) {
      return path.join(root, entry.name);
    }
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const match = await findSessionFile(path.join(root, entry.name), sessionId, depth + 1);
    if (match) return match;
  }
  return null;
}

export async function sessionActivityRevision(
  sessionIds: string[],
  sessionsRoot = defaultSessionsRoot(),
): Promise<string> {
  const parts: string[] = [];
  for (const sessionId of [...new Set(sessionIds.filter(Boolean))]) {
    const sessionFile = await findSessionFile(sessionsRoot, sessionId);
    if (!sessionFile) {
      parts.push(`${sessionId}:missing`);
      continue;
    }
    const metadata = await stat(sessionFile).catch(() => null);
    const signature = `${metadata?.size ?? -1}:${metadata?.mtimeMs ?? -1}`;
    const cacheKey = `${sessionId}:${sessionFile}`;
    const cached = revisionCache.get(cacheKey);
    if (cached?.signature === signature) {
      parts.push(`${sessionId}:${cached.revision}`);
      continue;
    }
    const activity = await readSessionActivity([sessionId], sessionsRoot);
    const revision = createHash("sha1")
      .update(activity.map((record) => `${record.timestamp}|${record.path}|${record.toolName ?? ""}`).join("\n"))
      .digest("hex")
      .slice(0, 16);
    revisionCache.set(cacheKey, { signature, revision });
    parts.push(`${sessionId}:${revision}`);
  }
  return createHash("sha1").update(parts.join("\n")).digest("hex").slice(0, 16);
}

function toolInput(payload: Record<string, unknown>): unknown {
  return payload.input ?? payload.arguments ?? payload.tool_input;
}

export async function readSessionActivity(
  sessionIds: string[],
  sessionsRoot = defaultSessionsRoot(),
): Promise<ActivityRecord[]> {
  const records: ActivityRecord[] = [];
  for (const sessionId of [...new Set(sessionIds.filter(Boolean))]) {
    const sessionFile = await findSessionFile(sessionsRoot, sessionId);
    if (!sessionFile) continue;
    const lines = createInterface({ input: createReadStream(sessionFile, { encoding: "utf8" }), crlfDelay: Infinity });
    for await (const line of lines) {
      if (!line.includes('"type":"response_item"')) continue;
      if (!/"payload":\{"type":"(?:custom_tool_call|function_call)"/.test(line)) continue;
      try {
        const event = JSON.parse(line) as {
          timestamp?: string;
          type?: string;
          payload?: Record<string, unknown>;
        };
        const payload = event.payload;
        if (event.type !== "response_item" || !payload) continue;
        if (payload.type !== "custom_tool_call" && payload.type !== "function_call") continue;
        const normalizedToolName = String(payload.name ?? "").toLowerCase().replace(/[^a-z]/g, "");
        if (normalizedToolName.includes("skilllens") && normalizedToolName.endsWith("read")) continue;
        const serializedInput = typeof toolInput(payload) === "string"
          ? String(toolInput(payload))
          : JSON.stringify(toolInput(payload) ?? {});
        const skillPaths = [...serializedInput.matchAll(SKILL_PATH)].map((match) => match[1]!);
        for (const skillPath of new Set(skillPaths)) {
          records.push({
            timestamp: event.timestamp ?? new Date(0).toISOString(),
            sessionId,
            turnId: typeof payload.call_id === "string" ? payload.call_id : null,
            toolName: typeof payload.name === "string" ? payload.name : null,
            path: skillPath,
            detection: "session-log-read",
          });
        }
      } catch {
        // A partially written or unknown event must not break the sidebar.
      }
    }
  }
  return records.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
