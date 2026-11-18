import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

let raw = "";
for await (const chunk of process.stdin) raw += chunk;

try {
  const event = JSON.parse(raw);
  const normalizedToolName = String(event.tool_name ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (normalizedToolName.includes("skilllens") && normalizedToolName.endsWith("read")) process.exit(0);
  const serializedInput = JSON.stringify(event.tool_input ?? {});
  const matches = [
    ...serializedInput.matchAll(/(?:file:\/\/)?([/~A-Za-z0-9_.+@%:=\\-][^"'\s]*?SKILL\.md)/gi),
  ];
  const uniquePaths = [...new Set(matches.map((match) => match[1]))];
  if (uniquePaths.length === 0) process.exit(0);

  const dataDir = process.env.PLUGIN_DATA;
  if (!dataDir) process.exit(0);
  await mkdir(dataDir, { recursive: true });

  const timestamp = new Date().toISOString();
  const records = uniquePaths.map((skillPath) =>
    JSON.stringify({
      timestamp,
      sessionId: event.session_id ?? null,
      turnId: event.turn_id ?? null,
      toolName: event.tool_name ?? null,
      path: skillPath,
      detection: "observed-read",
    }),
  );
  await appendFile(path.join(dataDir, "activity.jsonl"), `${records.join("\n")}\n`, "utf8");
} catch {
  // Observability must never interrupt the user's Codex task.
}
