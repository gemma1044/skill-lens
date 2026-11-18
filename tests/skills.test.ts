import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { readSkill, scanSkills } from "../src/server/skills.js";

test("scanSkills indexes SKILL.md metadata and exact content", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "skill-lens-"));
  const skillDirectory = path.join(root, "demo-skill");
  await mkdir(skillDirectory);
  const content = "---\nname: demo-skill\ndescription: A precise demo.\n---\n\n# Demo\n\nKeep this exact.";
  await writeFile(path.join(skillDirectory, "SKILL.md"), content);

  const snapshot = await scanSkills({ roots: [root], cwd: root, dataDir: path.join(root, "data") });
  assert.equal(snapshot.skills.length, 1);
  assert.equal(snapshot.skills[0]?.name, "demo-skill");
  assert.equal(snapshot.skills[0]?.description, "A precise demo.");
  assert.equal(snapshot.skills[0]?.source, "project");
  assert.equal(snapshot.skills[0]?.sessionObservedAt, null);
  assert.equal(snapshot.currentSession.trackingAvailable, false);

  const detail = await readSkill(snapshot.skills[0]!.path, snapshot);
  assert.equal(detail.content, content);
});

test("scanSkills separates current-session reads from historical reads", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "skill-lens-session-"));
  const dataDirectory = path.join(root, "data");
  const currentDirectory = path.join(root, "current-skill");
  const historicalDirectory = path.join(root, "historical-skill");
  await mkdir(dataDirectory);
  await mkdir(currentDirectory);
  await mkdir(historicalDirectory);
  const currentPath = path.join(currentDirectory, "SKILL.md");
  const historicalPath = path.join(historicalDirectory, "SKILL.md");
  await writeFile(currentPath, "---\nname: current-skill\ndescription: Current.\n---\n");
  await writeFile(historicalPath, "---\nname: historical-skill\ndescription: Historical.\n---\n");
  await writeFile(path.join(dataDirectory, "activity.jsonl"), [
    JSON.stringify({ timestamp: "2026-11-18T10:00:00.000Z", sessionId: "session-old", turnId: "1", toolName: "read", path: historicalPath, detection: "observed-read" }),
    JSON.stringify({ timestamp: "2026-11-18T10:30:00.000Z", sessionId: "session-current", turnId: "2", toolName: "mcp__skill_lens__skillLens_read", path: historicalPath, detection: "observed-read" }),
    JSON.stringify({ timestamp: "2026-11-18T11:00:00.000Z", sessionId: "session-current", turnId: "2", toolName: "read", path: currentPath, detection: "observed-read" }),
  ].join("\n"));

  const snapshot = await scanSkills({
    roots: [root],
    cwd: root,
    dataDir: dataDirectory,
    sessionIds: ["session-current"],
  });
  const current = snapshot.skills.find((skill) => skill.name === "current-skill");
  const historical = snapshot.skills.find((skill) => skill.name === "historical-skill");
  assert.equal(snapshot.currentSession.trackingAvailable, true);
  assert.equal(snapshot.currentSession.observedSkillCount, 1);
  assert.equal(current?.sessionObservedAt, "2026-11-18T11:00:00.000Z");
  assert.equal(historical?.sessionObservedAt, null);
  assert.equal(historical?.observedAt, "2026-11-18T10:00:00.000Z");
});

test("readSkill rejects paths outside the scanned catalog", async () => {
  const snapshot = await scanSkills({ roots: [], dataDir: "/nonexistent" });
  await assert.rejects(() => readSkill("/tmp/SKILL.md", snapshot), /不在当前允许/);
});
