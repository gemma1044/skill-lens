import { App } from "@modelcontextprotocol/ext-apps";
import "./styles.css";

import type { SkillDetail, SkillSnapshot, SkillSource, SkillSummary } from "../shared/contracts.js";

declare global {
  interface Window { __SKILL_LENS_PREVIEW__?: boolean | { apiBase?: string }; }
}

type ViewMode = "read" | "raw";
type State = {
  snapshot: SkillSnapshot | null;
  detail: SkillDetail | null;
  selectedPath: string | null;
  query: string;
  source: "all" | SkillSource;
  observedOnly: boolean;
  viewMode: ViewMode;
  loading: boolean;
};

const state: State = { snapshot: null, detail: null, selectedPath: null, query: "", source: "all", observedOnly: false, viewMode: "read", loading: true };
const root = document.querySelector<HTMLDivElement>("#app")!;
const app = new App({ name: "skill-lens", version: "0.1.0" });
const previewConfig = window.__SKILL_LENS_PREVIEW__;
const previewApi = typeof previewConfig === "object" ? (previewConfig.apiBase ?? "") : null;

const fallbackSnapshot: SkillSnapshot = {
  generatedAt: new Date().toISOString(), roots: [], activity: [],
  notices: ["演示数据。运行 npm run preview 可浏览本机真实 Skill。"],
  skills: [{ id: "demo", name: "example-skill", source: "other", description: "这是静态演示条目，不代表你本机 Skill 的真实长度。", path: "/demo/example-skill/SKILL.md", modifiedAt: new Date().toISOString(), observedAt: null, observedSessionId: null }],
};
const fallbackDetail: SkillDetail = { ...fallbackSnapshot.skills[0]!, content: "# Example Skill\n\n静态文件仅展示界面。通过本地预览服务或安装插件后，这里会显示完整、真实的 SKILL.md。" };

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!);
}

function inlineMarkdown(value: string): string {
  return escapeHtml(value).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function markdownBody(content: string): string {
  const body = content.startsWith("---") ? content.replace(/^---\n[\s\S]*?\n---\n?/, "") : content;
  const output: string[] = [];
  let list: "ul" | "ol" | null = null;
  let inCode = false;
  const closeList = () => { if (list) output.push(`</${list}>`); list = null; };
  for (const line of body.split("\n")) {
    if (line.startsWith("```")) { closeList(); output.push(inCode ? "</code></pre>" : "<pre><code>"); inCode = !inCode; continue; }
    if (inCode) { output.push(`${escapeHtml(line)}\n`); continue; }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (heading) {
      closeList(); const level = Math.min(3, heading[1]!.length + 1); output.push(`<h${level}>${inlineMarkdown(heading[2]!)}</h${level}>`);
    } else if (bullet || ordered) {
      const next = bullet ? "ul" : "ol";
      if (list !== next) { closeList(); list = next; output.push(`<${next}>`); }
      output.push(`<li>${inlineMarkdown((bullet ?? ordered)![1]!)}</li>`);
    } else if (line.startsWith("> ")) { closeList(); output.push(`<blockquote>${inlineMarkdown(line.slice(2))}</blockquote>`); }
    else if (line.trim()) { closeList(); output.push(`<p>${inlineMarkdown(line)}</p>`); }
    else closeList();
  }
  closeList(); if (inCode) output.push("</code></pre>");
  return output.join("");
}

function sourceLabel(source: SkillSource): string {
  return ({ personal: "个人", project: "项目", plugin: "插件", configured: "配置", other: "其他" })[source];
}

function relativeTime(value: string | null): string {
  if (!value) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "刚刚读取";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟前读取`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时前读取`;
  return `${Math.floor(seconds / 86400)} 天前读取`;
}

function filteredSkills(): SkillSummary[] {
  const query = state.query.trim().toLowerCase();
  return (state.snapshot?.skills ?? []).filter((skill) => (!query || `${skill.name} ${skill.description} ${skill.path}`.toLowerCase().includes(query)) && (state.source === "all" || skill.source === state.source) && (!state.observedOnly || Boolean(skill.observedAt)));
}

function render(): void {
  if (state.loading || !state.snapshot) { root.innerHTML = `<div class="loading"><span class="lens" aria-hidden="true"></span>正在读取 Skill…</div>`; return; }
  const skills = filteredSkills();
  const selected = state.detail;
  const sourceOptions = (["all", "personal", "project", "plugin", "configured", "other"] as const)
    .map((value) => `<option value="${value}" ${state.source === value ? "selected" : ""}>${value === "all" ? "所有来源" : sourceLabel(value)}</option>`).join("");
  root.innerHTML = `
    <main class="shell">
      <aside class="rail">
        <header class="topbar"><div class="wordmark"><span class="lens" aria-hidden="true"></span><strong>Skill Lens</strong><span>${state.snapshot.skills.length}</span></div><button class="plain-button" id="refresh" title="重新扫描" aria-label="重新扫描">↻</button></header>
        <div class="controls"><input class="search" id="search" type="search" value="${escapeHtml(state.query)}" placeholder="搜索 Skill" aria-label="搜索 Skill" /><div class="filter-row"><select id="source" aria-label="按来源筛选">${sourceOptions}</select><label class="observed-toggle"><input id="observed" type="checkbox" ${state.observedOnly ? "checked" : ""} /> 只看读取过</label></div></div>
        <div class="skill-list" aria-label="Skill 列表">
          ${skills.length ? skills.map((skill) => `<button class="skill-row" data-path="${escapeHtml(skill.path)}" aria-current="${state.selectedPath === skill.path}"><span class="row-head"><strong>${escapeHtml(skill.name)}</strong><span>${sourceLabel(skill.source)}</span></span><span class="skill-description">${escapeHtml(skill.description)}</span>${skill.observedAt ? `<span class="observed"><i></i>${relativeTime(skill.observedAt)}</span>` : ""}</button>`).join("") : `<div class="empty">没有匹配的 Skill</div>`}
        </div>
      </aside>
      <section class="viewer">
        ${selected ? `<header class="viewer-head"><div class="title-line"><h1>${escapeHtml(selected.name)}</h1>${selected.observedAt ? `<span class="status"><i></i>${relativeTime(selected.observedAt)}</span>` : ""}</div><p>${escapeHtml(selected.description)}</p><div class="meta"><span>${sourceLabel(selected.source)}</span><span title="${escapeHtml(selected.path)}">${escapeHtml(selected.path)}</span></div></header><div class="document-toolbar"><div class="view-switch" role="group" aria-label="内容显示方式"><button data-view="read" aria-pressed="${state.viewMode === "read"}">阅读</button><button data-view="raw" aria-pressed="${state.viewMode === "raw"}">原文</button></div><button class="copy" id="copy">复制全文</button></div>${state.viewMode === "read" ? `<article class="skill-document">${markdownBody(selected.content)}</article>` : `<pre class="raw-document">${escapeHtml(selected.content)}</pre>`}<footer class="scope-note">${escapeHtml(state.snapshot.notices[0] ?? "只读浏览，不修改 Skill。")}</footer>` : `<div class="empty viewer-empty">选择一个 Skill 查看完整内容</div>`}
      </section>
    </main>`;

  root.querySelector<HTMLInputElement>("#search")?.addEventListener("input", (event) => { state.query = (event.target as HTMLInputElement).value; render(); const input = root.querySelector<HTMLInputElement>("#search"); input?.focus(); input?.setSelectionRange(state.query.length, state.query.length); });
  root.querySelector<HTMLSelectElement>("#source")?.addEventListener("change", (event) => { state.source = (event.target as HTMLSelectElement).value as State["source"]; render(); });
  root.querySelector<HTMLInputElement>("#observed")?.addEventListener("change", (event) => { state.observedOnly = (event.target as HTMLInputElement).checked; render(); });
  root.querySelectorAll<HTMLButtonElement>("[data-path]").forEach((button) => button.addEventListener("click", () => void selectSkill(button.dataset.path!)));
  root.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((button) => button.addEventListener("click", () => { state.viewMode = button.dataset.view as ViewMode; render(); }));
  root.querySelector<HTMLButtonElement>("#refresh")?.addEventListener("click", () => void refresh());
  root.querySelector<HTMLButtonElement>("#copy")?.addEventListener("click", async () => { if (!state.detail) return; await navigator.clipboard.writeText(state.detail.content); const button = root.querySelector<HTMLButtonElement>("#copy"); if (button) { button.textContent = "已复制"; setTimeout(() => { button.textContent = "复制全文"; }, 1200); } });
}

async function previewRequest<T>(path: string): Promise<T> {
  const response = await fetch(`${previewApi}${path}`);
  if (!response.ok) throw new Error(`Preview request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

async function selectSkill(skillPath: string): Promise<void> {
  state.selectedPath = skillPath;
  if (previewApi !== null) {
    state.detail = state.snapshot?.skills[0]?.id === "demo"
      ? fallbackDetail
      : previewApi
        ? (await previewRequest<{ detail: SkillDetail }>(`/api/skill?path=${encodeURIComponent(skillPath)}`)).detail
        : fallbackDetail;
    render(); return;
  }
  const response = await app.callServerTool({ name: "skillLens.read", arguments: { path: skillPath } });
  const content = response.structuredContent as { detail?: SkillDetail } | undefined;
  if (content?.detail) state.detail = content.detail;
  render();
}

async function refresh(): Promise<void> {
  if (previewApi !== null) {
    try {
      state.snapshot = previewApi ? (await previewRequest<{ snapshot: SkillSnapshot }>("/api/snapshot")).snapshot : fallbackSnapshot;
    } catch {
      state.snapshot = fallbackSnapshot;
    }
  }
  else {
    const response = await app.callServerTool({ name: "skillLens.list", arguments: {} });
    const content = response.structuredContent as { snapshot?: SkillSnapshot } | undefined;
    if (content?.snapshot) state.snapshot = content.snapshot;
  }
  if (!state.snapshot) return;
  if (state.selectedPath && state.snapshot.skills.some((skill) => skill.path === state.selectedPath)) await selectSkill(state.selectedPath);
  else if (state.snapshot.skills[0]) await selectSkill(state.snapshot.skills[0].path);
  else render();
}

if (previewApi !== null) { await refresh(); state.loading = false; render(); }
else {
  app.ontoolresult = (toolResult) => {
    const content = toolResult.structuredContent as { snapshot?: SkillSnapshot; detail?: SkillDetail } | undefined;
    if (content?.snapshot) state.snapshot = content.snapshot;
    if (content?.detail) { state.detail = content.detail; state.selectedPath = content.detail.path; }
    state.loading = false;
    if (!state.selectedPath && state.snapshot?.skills[0]) void selectSkill(state.snapshot.skills[0].path); else render();
  };
  await app.connect();
}
