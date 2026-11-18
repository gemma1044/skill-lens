import { createHash } from "node:crypto";
import { readdir, readFile, realpath, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type {
  ActivityRecord,
  SkillDetail,
  SkillSnapshot,
  SkillSource,
  SkillSummary,
} from "../shared/contracts.js";

const SKILL_FILE = /^skill\.md$/i;
const MAX_SCAN_DEPTH = 6;
const MAX_SKILLS = 2500;

function expandHome(value: string): string {
  if (value === "~") return os.homedir();
  if (value.startsWith("~/")) return path.join(os.homedir(), value.slice(2));
  return path.resolve(value);
}

export function defaultSkillRoots(cwd = process.cwd()): string[] {
  const configured = (process.env.SKILL_LENS_ROOTS ?? "")
    .split(path.delimiter)
    .map((value) => value.trim())
    .filter(Boolean)
    .map(expandHome);
  return [
    ...configured,
    path.join(os.homedir(), ".codex", "skills"),
    path.join(os.homedir(), ".agents", "skills"),
    path.join(os.homedir(), ".codex", "plugins"),
    path.join(cwd, ".agents", "skills"),
    path.join(cwd, ".codex", "skills"),
  ].filter((value, index, all) => all.indexOf(value) === index);
}

function parseFrontmatter(content: string): { name?: string; description?: string } {
  if (!content.startsWith("---")) return {};
  const end = content.indexOf("\n---", 3);
  if (end < 0) return {};
  const frontmatter = content.slice(3, end);
  const valueFor = (key: string) => {
    const match = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
    return match?.[1]?.trim().replace(/^(["'])(.*)\1$/, "$2");
  };
  return { name: valueFor("name"), description: valueFor("description") };
}

function classifySource(skillPath: string, cwd = process.cwd()): SkillSource {
  const normalized = path.resolve(skillPath);
  if (normalized.includes(`${path.sep}.codex${path.sep}plugins${path.sep}`)) return "plugin";
  if (normalized.startsWith(path.resolve(cwd) + path.sep)) return "project";
  if (normalized.includes(`${path.sep}.codex${path.sep}skills${path.sep}`)) return "personal";
  if (normalized.includes(`${path.sep}.agents${path.sep}skills${path.sep}`)) return "personal";
  if ((process.env.SKILL_LENS_ROOTS ?? "").split(path.delimiter).some((root) => normalized.startsWith(expandHome(root)))) {
    return "configured";
  }
  return "other";
}

async function walk(root: string, depth = 0, output: string[] = []): Promise<string[]> {
  if (depth > MAX_SCAN_DEPTH || output.length >= MAX_SKILLS) return output;
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return output;
  }
  for (const entry of entries) {
    if (output.length >= MAX_SKILLS) break;
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const entryPath = path.join(root, entry.name);
    if (entry.isFile() && SKILL_FILE.test(entry.name)) output.push(entryPath);
    if (entry.isDirectory()) await walk(entryPath, depth + 1, output);
  }
  return output;
}

export async function readActivity(dataDir = process.env.PLUGIN_DATA): Promise<ActivityRecord[]> {
  if (!dataDir) return [];
  try {
    const raw = await readFile(path.join(dataDir, "activity.jsonl"), "utf8");
    return raw
      .trim()
      .split("\n")
      .slice(-500)
      .flatMap((line) => {
        try {
          return [JSON.parse(line) as ActivityRecord];
        } catch {
          return [];
        }
      })
      .reverse();
  } catch {
    return [];
  }
}

export async function scanSkills(options: {
  roots?: string[];
  cwd?: string;
  dataDir?: string;
} = {}): Promise<SkillSnapshot> {
  const cwd = options.cwd ?? process.cwd();
  const canonicalCwd = await realpath(cwd).catch(() => path.resolve(cwd));
  const roots = options.roots ?? defaultSkillRoots(cwd);
  const discoveredPaths = (await Promise.all(roots.map((root) => walk(root)))).flat();
  const paths = [
    ...new Set(
      await Promise.all(
        discoveredPaths.map(async (skillPath) => {
          try {
            return await realpath(skillPath);
          } catch {
            return path.resolve(skillPath);
          }
        }),
      ),
    ),
  ];
  const activity = await readActivity(options.dataDir);
  const latestByPath = new Map<string, ActivityRecord>();
  for (const record of activity) {
    const normalized = path.resolve(expandHome(record.path));
    if (!latestByPath.has(normalized)) latestByPath.set(normalized, record);
  }

  const skills = (
    await Promise.all(
      paths.map(async (skillPath): Promise<SkillSummary | null> => {
        try {
          const [content, metadata] = await Promise.all([readFile(skillPath, "utf8"), stat(skillPath)]);
          const frontmatter = parseFrontmatter(content);
          const observed = latestByPath.get(path.resolve(skillPath));
          return {
            id: createHash("sha1").update(path.resolve(skillPath)).digest("hex").slice(0, 12),
            name: frontmatter.name || path.basename(path.dirname(skillPath)),
            description: frontmatter.description || "没有 description 元数据",
            path: skillPath,
            source: classifySource(skillPath, canonicalCwd),
            modifiedAt: metadata.mtime.toISOString(),
            observedAt: observed?.timestamp ?? null,
            observedSessionId: observed?.sessionId ?? null,
          };
        } catch {
          return null;
        }
      }),
    )
  )
    .filter((skill): skill is SkillSummary => skill !== null)
    .sort((a, b) => {
      if (a.observedAt && b.observedAt) return b.observedAt.localeCompare(a.observedAt);
      if (a.observedAt) return -1;
      if (b.observedAt) return 1;
      return a.name.localeCompare(b.name);
    });

  return {
    generatedAt: new Date().toISOString(),
    skills,
    activity,
    roots,
    notices: [
      "“检测到读取”来自本地工具 Hook，不等同于 Codex 官方 SkillActivated 事件。",
      ...(paths.length >= MAX_SKILLS ? [`扫描达到 ${MAX_SKILLS} 个 Skill 的安全上限。`] : []),
    ],
  };
}

export async function readSkill(skillPath: string, snapshot: SkillSnapshot): Promise<SkillDetail> {
  const resolved = path.resolve(skillPath);
  const summary = snapshot.skills.find((skill) => path.resolve(skill.path) === resolved);
  if (!summary) throw new Error("Skill 不在当前允许的扫描结果中。");
  return { ...summary, content: await readFile(summary.path, "utf8") };
}
