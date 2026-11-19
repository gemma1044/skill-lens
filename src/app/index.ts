import { App } from "@modelcontextprotocol/ext-apps";
import "./styles.css";

import type { SkillDetail, SkillSessionStatus, SkillSnapshot, SkillSource, SkillSummary } from "../shared/contracts.js";

declare global {
  interface Window { __SKILL_LENS_PREVIEW__?: boolean | { apiBase?: string }; }
}

type ViewMode = "read" | "raw";
type CatalogView = "session" | "all";
type SessionMode = "follow" | "pinned";
type SyncState = "live" | "checking" | "error";
type State = {
  snapshot: SkillSnapshot | null;
  detail: SkillDetail | null;
  selectedPath: string | null;
  query: string;
  source: "all" | SkillSource;
  catalogView: CatalogView;
  viewMode: ViewMode;
  sessionMode: SessionMode;
  pinnedSessionIds: string[] | null;
  syncState: SyncState;
  loading: boolean;
};

const state: State = { snapshot: null, detail: null, selectedPath: null, query: "", source: "all", catalogView: "session", viewMode: "read", sessionMode: "follow", pinnedSessionIds: null, syncState: "live", loading: true };
const root = document.querySelector<HTMLDivElement>("#app")!;
const app = new App({ name: "skill-lens", version: "0.1.4" });
const previewConfig = window.__SKILL_LENS_PREVIEW__;
const previewApi = typeof previewConfig === "object" ? (previewConfig.apiBase ?? "") : null;

const fallbackSnapshot: SkillSnapshot = {
  generatedAt: new Date().toISOString(), roots: [], activity: [],
  notices: ["演示数据。运行 npm run preview 可浏览本机真实 Skill。"],
  currentSession: { trackingAvailable: true, observedSkillCount: 1, sessionIds: ["demo"], primarySessionId: "demo", activityRevision: "demo" },
  skills: [{ id: "demo", name: "example-skill", source: "other", description: "这是静态演示条目，不代表你本机 Skill 的真实长度。", path: "/demo/example-skill/SKILL.md", modifiedAt: new Date().toISOString(), observedAt: new Date().toISOString(), observedSessionId: "demo", sessionObservedAt: new Date().toISOString() }],
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
  return (state.snapshot?.skills ?? []).filter((skill) =>
    (!query || `${skill.name} ${skill.description} ${skill.path}`.toLowerCase().includes(query))
    && (state.source === "all" || skill.source === state.source)
    && (state.catalogView === "all" || Boolean(skill.sessionObservedAt)),
  );
}

function observationLabel(skill: SkillSummary): string {
  if (skill.sessionObservedAt) return relativeTime(skill.sessionObservedAt);
  if (skill.observedAt) return `历史记录 · ${relativeTime(skill.observedAt)}`;
  return "";
}

function requestedSessionIds(): string[] | undefined {
  return state.sessionMode === "pinned" ? (state.pinnedSessionIds ?? undefined) : undefined;
}

function sessionModeLabel(): string {
  return state.sessionMode === "pinned" ? "固定此 Session" : "跟随当前";
}

function syncLabel(): string {
  if (state.syncState === "checking") return "正在检查";
  if (state.syncState === "error") return "自动更新暂时中断";
  return "自动更新";
}

function emptyList(): string {
  if (state.catalogView === "all") return `<div class="empty">没有匹配的 Skill</div>`;
  if (!state.snapshot?.currentSession.trackingAvailable) {
    return `<div class="empty session-empty"><strong>无法识别当前 Session</strong><span>请重启 Codex Desktop，让插件获得本会话标识。</span><button data-catalog="all">查看全部 Skill</button></div>`;
  }
  return `<div class="empty session-empty"><strong>本 Session 还没有读取记录</strong><span>只有被工具实际读取的 SKILL.md 才会出现在这里。</span><button data-catalog="all">查看全部 Skill</button></div>`;
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
        <header class="topbar"><div class="wordmark"><span class="lens" aria-hidden="true"></span><strong>Skill Lens</strong></div><button class="plain-button" id="refresh" title="重新扫描" aria-label="重新扫描">↻</button></header>
        <div class="scope-switch" role="tablist" aria-label="Skill 范围"><button data-catalog="session" role="tab" aria-selected="${state.catalogView === "session"}">当前 Session <span>${state.snapshot.currentSession.observedSkillCount}</span></button><button data-catalog="all" role="tab" aria-selected="${state.catalogView === "all"}">全部 Skill <span>${state.snapshot.skills.length}</span></button></div>
        ${state.catalogView === "all" ? `<div class="controls"><input class="search" id="search" type="search" value="${escapeHtml(state.query)}" placeholder="在全部 Skill 中搜索" aria-label="搜索全部 Skill" /><div class="filter-row"><select id="source" aria-label="按来源筛选">${sourceOptions}</select><span>${skills.length} 项</span></div></div>` : `<div class="session-summary"><span class="live-state ${state.syncState === "error" ? "error" : ""}"><i></i>${syncLabel()}</span><button id="session-mode" title="${state.sessionMode === "pinned" ? "点击后改为跟随当前 Session" : "点击后固定在此 Session"}">${sessionModeLabel()}</button><strong>${skills.length}</strong></div>`}
        <div class="skill-list" aria-label="Skill 列表">
          ${skills.length ? skills.map((skill) => `<button class="skill-row" data-path="${escapeHtml(skill.path)}" aria-current="${state.selectedPath === skill.path}"><span class="row-head"><strong>${escapeHtml(skill.name)}</strong><span>${sourceLabel(skill.source)}</span></span><span class="skill-description">${escapeHtml(skill.description)}</span>${observationLabel(skill) ? `<span class="observed ${skill.sessionObservedAt ? "" : "historical"}"><i></i>${observationLabel(skill)}</span>` : ""}</button>`).join("") : emptyList()}
        </div>
      </aside>
      <section class="viewer">
        ${selected ? `<header class="viewer-head"><div class="title-line"><h1>${escapeHtml(selected.name)}</h1>${observationLabel(selected) ? `<span class="status ${selected.sessionObservedAt ? "" : "historical"}"><i></i>${observationLabel(selected)}</span>` : ""}</div><p>${escapeHtml(selected.description)}</p><div class="meta"><span>${sourceLabel(selected.source)}</span><span title="${escapeHtml(selected.path)}">${escapeHtml(selected.path)}</span></div></header><div class="document-toolbar"><div class="view-switch" role="group" aria-label="内容显示方式"><button data-view="read" aria-pressed="${state.viewMode === "read"}">阅读</button><button data-view="raw" aria-pressed="${state.viewMode === "raw"}">原文</button></div><button class="copy" id="copy">复制全文</button></div>${state.viewMode === "read" ? `<article class="skill-document">${markdownBody(selected.content)}</article>` : `<pre class="raw-document">${escapeHtml(selected.content)}</pre>`}<footer class="scope-note">${escapeHtml(state.snapshot.notices[0] ?? "只读浏览，不修改 Skill。")}</footer>` : `<div class="empty viewer-empty">${state.catalogView === "session" ? "本 Session 暂无可查看的 Skill" : "选择一个 Skill 查看完整内容"}</div>`}
      </section>
    </main>`;

  root.querySelector<HTMLInputElement>("#search")?.addEventListener("input", (event) => { state.query = (event.target as HTMLInputElement).value; render(); const input = root.querySelector<HTMLInputElement>("#search"); input?.focus(); input?.setSelectionRange(state.query.length, state.query.length); });
  root.querySelector<HTMLSelectElement>("#source")?.addEventListener("change", (event) => { state.source = (event.target as HTMLSelectElement).value as State["source"]; render(); });
  root.querySelectorAll<HTMLButtonElement>("[data-catalog]").forEach((button) => button.addEventListener("click", () => void switchCatalog(button.dataset.catalog as CatalogView)));
  root.querySelectorAll<HTMLButtonElement>("[data-path]").forEach((button) => button.addEventListener("click", () => void selectSkill(button.dataset.path!)));
  root.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((button) => button.addEventListener("click", () => { state.viewMode = button.dataset.view as ViewMode; render(); }));
  root.querySelector<HTMLButtonElement>("#refresh")?.addEventListener("click", () => void refresh());
  root.querySelector<HTMLButtonElement>("#session-mode")?.addEventListener("click", () => void toggleSessionMode());
  root.querySelector<HTMLButtonElement>("#copy")?.addEventListener("click", async () => { if (!state.detail) return; await navigator.clipboard.writeText(state.detail.content); const button = root.querySelector<HTMLButtonElement>("#copy"); if (button) { button.textContent = "已复制"; setTimeout(() => { button.textContent = "复制全文"; }, 1200); } });
}

async function switchCatalog(catalogView: CatalogView): Promise<void> {
  state.catalogView = catalogView;
  if (catalogView === "session") {
    state.query = "";
    state.source = "all";
  }
  const skills = filteredSkills();
  if (state.selectedPath && skills.some((skill) => skill.path === state.selectedPath)) { render(); return; }
  state.selectedPath = null;
  state.detail = null;
  if (skills[0]) await selectSkill(skills[0].path);
  else render();
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
  const response = await app.callServerTool({ name: "skillLens.read", arguments: { path: skillPath, sessionIds: requestedSessionIds() } });
  const content = response.structuredContent as { detail?: SkillDetail } | undefined;
  if (content?.detail) state.detail = content.detail;
  render();
}

async function refresh(sessionIds = requestedSessionIds()): Promise<void> {
  if (previewApi !== null) {
    try {
      const query = sessionIds?.map((id) => `sessionId=${encodeURIComponent(id)}`).join("&");
      state.snapshot = previewApi ? (await previewRequest<{ snapshot: SkillSnapshot }>(`/api/snapshot${query ? `?${query}` : ""}`)).snapshot : fallbackSnapshot;
    } catch {
      state.snapshot = fallbackSnapshot;
    }
  }
  else {
    const response = await app.callServerTool({ name: "skillLens.list", arguments: { sessionIds } });
    const content = response.structuredContent as { snapshot?: SkillSnapshot } | undefined;
    if (content?.snapshot) state.snapshot = content.snapshot;
  }
  if (!state.snapshot) return;
  const skills = filteredSkills();
  if (state.selectedPath && skills.some((skill) => skill.path === state.selectedPath)) await selectSkill(state.selectedPath);
  else if (skills[0]) await selectSkill(skills[0].path);
  else { state.selectedPath = null; state.detail = null; render(); }
}

async function toggleSessionMode(): Promise<void> {
  if (state.sessionMode === "follow") {
    const ids = state.snapshot?.currentSession.sessionIds ?? [];
    if (!ids.length) return;
    state.sessionMode = "pinned";
    state.pinnedSessionIds = [...ids];
    render();
    return;
  }
  state.sessionMode = "follow";
  state.pinnedSessionIds = null;
  render();
  await checkStatus(true);
}

let statusCheckRunning = false;
async function checkStatus(forceRefresh = false): Promise<void> {
  if (statusCheckRunning || state.loading || document.visibilityState === "hidden") return;
  statusCheckRunning = true;
  const previousSyncState = state.syncState;
  state.syncState = "checking";
  try {
    let status: SkillSessionStatus;
    if (previewApi !== null) {
      const query = requestedSessionIds()?.map((id) => `sessionId=${encodeURIComponent(id)}`).join("&");
      status = previewApi
        ? (await previewRequest<{ status: SkillSessionStatus }>(`/api/status${query ? `?${query}` : ""}`)).status
        : { trackingAvailable: true, sessionIds: ["demo"], primarySessionId: "demo", activityRevision: "demo", checkedAt: new Date().toISOString() };
    } else {
      const response = await app.callServerTool({ name: "skillLens.status", arguments: { sessionIds: requestedSessionIds() } });
      const content = response.structuredContent as { status?: SkillSessionStatus } | undefined;
      if (!content?.status) throw new Error("Missing Skill Lens status");
      status = content.status;
    }
    const current = state.snapshot?.currentSession;
    const sessionChanged = state.sessionMode === "follow"
      && JSON.stringify(status.sessionIds) !== JSON.stringify(current?.sessionIds ?? []);
    const activityChanged = status.activityRevision !== current?.activityRevision;
    state.syncState = "live";
    if (forceRefresh || sessionChanged || activityChanged) await refresh(status.sessionIds);
    else if (previousSyncState === "error") render();
  } catch {
    state.syncState = "error";
    if (previousSyncState !== "error") render();
  } finally {
    statusCheckRunning = false;
  }
}

function startAutoRefresh(): void {
  window.setInterval(() => void checkStatus(), 2500);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") void checkStatus(true); });
  window.addEventListener("focus", () => void checkStatus());
}

if (previewApi !== null) { await refresh(); state.loading = false; render(); startAutoRefresh(); }
else {
  app.addEventListener("hostcontextchanged", () => { if (state.sessionMode === "follow") void checkStatus(true); });
  app.ontoolresult = (toolResult) => {
    const content = toolResult.structuredContent as { snapshot?: SkillSnapshot; detail?: SkillDetail } | undefined;
    if (content?.snapshot) state.snapshot = content.snapshot;
    if (content?.detail) { state.detail = content.detail; state.selectedPath = content.detail.path; }
    state.loading = false;
    const skills = filteredSkills();
    if (!state.selectedPath && skills[0]) void selectSkill(skills[0].path); else render();
  };
  await app.connect();
  startAutoRefresh();
}
