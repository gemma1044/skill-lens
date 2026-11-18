import { App } from "@modelcontextprotocol/ext-apps";
import "./styles.css";

import type { SkillDetail, SkillSnapshot, SkillSource, SkillSummary } from "../shared/contracts.js";

declare global {
  interface Window { __SKILL_LENS_PREVIEW__?: boolean; }
}

type State = {
  snapshot: SkillSnapshot | null;
  detail: SkillDetail | null;
  selectedPath: string | null;
  query: string;
  filter: "all" | "observed" | SkillSource;
  loading: boolean;
};

const state: State = {
  snapshot: null,
  detail: null,
  selectedPath: null,
  query: "",
  filter: "all",
  loading: true,
};
const root = document.querySelector<HTMLDivElement>("#app")!;
const app = new App({ name: "skill-lens", version: "0.1.0" });

const previewSnapshot: SkillSnapshot = {
  generatedAt: new Date().toISOString(),
  roots: ["~/.codex/skills", "./.agents/skills"],
  notices: ["“检测到读取”来自本地工具 Hook，不等同于 Codex 官方 SkillActivated 事件。"],
  activity: [],
  skills: [
    {
      id: "frontend-design", name: "frontend-design", source: "personal",
      description: "建立产品的视觉规范，并在实现前校准布局、颜色、字体和交互。",
      path: "/Users/example/.codex/skills/frontend-design/SKILL.md",
      modifiedAt: new Date().toISOString(), observedAt: new Date().toISOString(), observedSessionId: "01a1…c80",
    },
    {
      id: "code-reality-first", name: "code-reality-first", source: "configured",
      description: "工程任务先核对现有入口、组件与数据通道，再决定复用或新增。",
      path: "/Users/example/Projects/skills/code-reality-first/SKILL.md",
      modifiedAt: new Date().toISOString(), observedAt: new Date(Date.now() - 180000).toISOString(), observedSessionId: "01a1…c80",
    },
    {
      id: "openai-docs", name: "openai-docs", source: "plugin",
      description: "查询并引用 OpenAI 官方文档，回答 Codex、API 和插件相关问题。",
      path: "/Users/example/.codex/plugins/openai-docs/SKILL.md",
      modifiedAt: new Date().toISOString(), observedAt: null, observedSessionId: null,
    },
    {
      id: "writing-quality-gate", name: "writing-quality-gate", source: "project",
      description: "在交付长文前检查事实、结构、证据和语言质量。",
      path: "/workspace/.agents/skills/writing-quality-gate/SKILL.md",
      modifiedAt: new Date().toISOString(), observedAt: null, observedSessionId: null,
    },
  ],
};

const previewDetail: SkillDetail = {
  ...previewSnapshot.skills[0]!,
  content: `---\nname: frontend-design\ndescription: 建立产品的视觉规范，并在实现前校准布局、颜色、字体和交互。\n---\n\n# Frontend Design\n\n先确认这是新产品还是已有产品。新产品必须在首个界面之前建立最小可用的视觉规范。\n\n## 当前任务\n\n- 定义受众与界面的单一工作；\n- 建立颜色、字体、间距与动效 Token；\n- 实现后截图检查真实状态。`,
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]!);
}

function sourceLabel(source: SkillSource): string {
  return ({ personal: "个人", project: "项目", plugin: "插件", configured: "配置", other: "其他" })[source];
}

function relativeTime(value: string | null): string {
  if (!value) return "未检测到";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "刚刚";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟前`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时前`;
  return `${Math.floor(seconds / 86400)} 天前`;
}

function filteredSkills(): SkillSummary[] {
  const query = state.query.trim().toLowerCase();
  return (state.snapshot?.skills ?? []).filter((skill) => {
    const matchesQuery = !query || `${skill.name} ${skill.description} ${skill.path}`.toLowerCase().includes(query);
    const matchesFilter = state.filter === "all"
      || (state.filter === "observed" ? Boolean(skill.observedAt) : skill.source === state.filter);
    return matchesQuery && matchesFilter;
  });
}

function render(): void {
  if (state.loading || !state.snapshot) {
    root.innerHTML = `<div class="loading"><div><div class="scan-ring"></div>正在校准 Skill 索引…</div></div>`;
    return;
  }
  const skills = filteredSkills();
  const observed = state.snapshot.skills.filter((skill) => skill.observedAt).length;
  const selected = state.detail;
  const filters: Array<[State["filter"], string]> = [
    ["all", "全部"], ["observed", "检测到读取"], ["personal", "个人"],
    ["project", "项目"], ["plugin", "插件"], ["configured", "配置"],
  ];

  root.innerHTML = `
    <main class="shell">
      <aside class="rail">
        <header class="masthead">
          <div class="brandline"><div class="brandmark" aria-hidden="true"></div><div><div class="eyebrow">Codex observatory</div><h1>Skill Lens</h1></div></div>
          <div class="summary">
            <div class="metric"><strong>${state.snapshot.skills.length}</strong><span>可用 Skill</span></div>
            <div class="metric"><strong>${observed}</strong><span>检测到读取</span></div>
            <div class="metric"><strong>${new Set(state.snapshot.skills.map((skill) => skill.source)).size}</strong><span>来源</span></div>
          </div>
        </header>
        <div class="toolbar">
          <input class="search" id="search" type="search" value="${escapeHtml(state.query)}" placeholder="搜索 Skill、说明或路径" aria-label="搜索 Skill" />
          <button class="icon-button" id="refresh" title="重新扫描" aria-label="重新扫描">↻</button>
        </div>
        <div class="filters" role="group" aria-label="筛选 Skill">
          ${filters.map(([value, label]) => `<button class="filter" data-filter="${value}" aria-pressed="${state.filter === value}">${label}</button>`).join("")}
        </div>
        <div class="skill-list">
          ${skills.length ? skills.map((skill) => `
            <button class="skill-row" data-path="${escapeHtml(skill.path)}" aria-current="${state.selectedPath === skill.path}">
              <span class="status-dot ${skill.observedAt ? "observed" : ""}" aria-hidden="true"></span>
              <span><span class="skill-name">${escapeHtml(skill.name)}</span><span class="skill-description">${escapeHtml(skill.description)}</span></span>
              <span class="source">${sourceLabel(skill.source)}</span>
            </button>`).join("") : `<div class="empty">没有符合当前筛选条件的 Skill。</div>`}
        </div>
      </aside>
      <section class="viewer">
        ${selected ? `
          <article class="viewer-card">
            <header class="viewer-head">
              <div><div class="eyebrow">Skill instructions</div><h2 class="viewer-title">${escapeHtml(selected.name)}</h2><div class="viewer-description">${escapeHtml(selected.description)}</div></div>
              ${selected.observedAt ? `<div class="activity-badge">${relativeTime(selected.observedAt)}检测到读取</div>` : ""}
            </header>
            <div class="meta-grid">
              <div class="meta-cell"><span class="meta-label">来源</span><span class="meta-value">${sourceLabel(selected.source)}</span></div>
              <div class="meta-cell"><span class="meta-label">最后修改</span><span class="meta-value">${new Date(selected.modifiedAt).toLocaleString()}</span></div>
              <div class="meta-cell"><span class="meta-label">文件</span><span class="meta-value" title="${escapeHtml(selected.path)}">${escapeHtml(selected.path)}</span></div>
            </div>
            <div class="code-wrap"><div class="code-toolbar"><span>SKILL.md · 原文</span><button class="copy" id="copy">复制全文</button></div><pre id="skill-content">${escapeHtml(selected.content)}</pre></div>
          </article>` : `<div class="viewer-card empty"><div class="scan-ring"></div><strong>选择一个 Skill</strong><p>点击左侧条目查看它的完整 SKILL.md 原文与来源。</p></div>`}
        <div class="notice">${escapeHtml(state.snapshot.notices[0] ?? "Skill Lens 只读取文件，不修改 Skill。")}</div>
      </section>
    </main>`;

  root.querySelector<HTMLInputElement>("#search")?.addEventListener("input", (event) => {
    state.query = (event.target as HTMLInputElement).value;
    render();
    const input = root.querySelector<HTMLInputElement>("#search");
    input?.focus(); input?.setSelectionRange(state.query.length, state.query.length);
  });
  root.querySelectorAll<HTMLButtonElement>("[data-filter]").forEach((button) => button.addEventListener("click", () => {
    state.filter = button.dataset.filter as State["filter"]; render();
  }));
  root.querySelectorAll<HTMLButtonElement>("[data-path]").forEach((button) => button.addEventListener("click", () => void selectSkill(button.dataset.path!)));
  root.querySelector<HTMLButtonElement>("#refresh")?.addEventListener("click", () => void refresh());
  root.querySelector<HTMLButtonElement>("#copy")?.addEventListener("click", async () => {
    if (!state.detail) return;
    await navigator.clipboard.writeText(state.detail.content);
    const button = root.querySelector<HTMLButtonElement>("#copy");
    if (button) { button.textContent = "已复制"; setTimeout(() => { button.textContent = "复制全文"; }, 1200); }
  });
}

async function selectSkill(skillPath: string): Promise<void> {
  state.selectedPath = skillPath;
  if (window.__SKILL_LENS_PREVIEW__) {
    const summary = state.snapshot?.skills.find((skill) => skill.path === skillPath);
    state.detail = summary?.id === previewDetail.id ? previewDetail : { ...summary!, content: `---\nname: ${summary?.name}\ndescription: ${summary?.description}\n---\n\n# ${summary?.name}\n\n这是预览环境中的示例 SKILL.md。` };
    render(); return;
  }
  const response = await app.callServerTool({ name: "skillLens.read", arguments: { path: skillPath } });
  const content = response.structuredContent as { detail?: SkillDetail } | undefined;
  if (content?.detail) state.detail = content.detail;
  render();
}

async function refresh(): Promise<void> {
  if (window.__SKILL_LENS_PREVIEW__) { state.snapshot = previewSnapshot; render(); return; }
  const response = await app.callServerTool({ name: "skillLens.list", arguments: {} });
  const content = response.structuredContent as { snapshot?: SkillSnapshot } | undefined;
  if (content?.snapshot) state.snapshot = content.snapshot;
  if (state.selectedPath) await selectSkill(state.selectedPath);
  else render();
}

if (window.__SKILL_LENS_PREVIEW__) {
  state.snapshot = previewSnapshot;
  state.detail = previewDetail;
  state.selectedPath = previewDetail.path;
  state.loading = false;
  render();
} else {
  app.ontoolresult = (toolResult) => {
    const content = toolResult.structuredContent as { snapshot?: SkillSnapshot; detail?: SkillDetail } | undefined;
    if (content?.snapshot) state.snapshot = content.snapshot;
    if (content?.detail) { state.detail = content.detail; state.selectedPath = content.detail.path; }
    state.loading = false;
    if (!state.selectedPath && state.snapshot?.skills[0]) void selectSkill(state.snapshot.skills[0].path);
    else render();
  };
  await app.connect();
}
