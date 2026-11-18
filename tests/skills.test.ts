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

  const detail = await readSkill(snapshot.skills[0]!.path, snapshot);
  assert.equal(detail.content, content);
});

test("readSkill rejects paths outside the scanned catalog", async () => {
  const snapshot = await scanSkills({ roots: [], dataDir: "/nonexistent" });
  await assert.rejects(() => readSkill("/tmp/SKILL.md", snapshot), /不在当前允许/);
});
