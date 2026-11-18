# Preview v0.1.0 — 看见 Codex 正在参考哪些 Skill

- 日期：2026-11-18
- Git tag：`preview-v0.1.0`
- Commit：以公开仓库 `preview-v0.1.0` tag 为准
- 当前入口：Codex 侧边栏 **Skill Lens**；开发预览为 `dist/preview.html`
- 状态：可安装的本机插件 MVP

## 这一版能做什么

用户可以从稳定的侧边栏入口浏览本地 Skill，按来源筛选、搜索、点击查看完整 `SKILL.md`，并识别最近被本地工具读取的 Skill。

## 为什么改

Codex 的 Skill 采用渐进加载，但用户此前没有可见入口确认元数据、完整说明与最近读取信号。

## 关键取舍

- 选择只读观察，放弃首版编辑能力，避免插件改变它正在解释的规则。
- 选择“检测到读取”而非“已激活”，因为当前官方 Hooks 没有 `SkillActivated` 事件。
- 选择本机插件而非公共目录插件，因为活动推断依赖本地生命周期 Hook。

## 前后对比

| 之前 | 现在 |
| --- | --- |
| 需要在不同目录手动寻找 Skill | 一个侧边栏列出 Skill、来源与路径 |
| 无法确认完整说明 | 点击即可查看原始 `SKILL.md` |
| Skill 使用过程不可见 | 最近文件读取有明确、有限的观察信号 |

## 验证

- 路径：构建插件 → 打开开发预览 → 搜索与筛选 → 点击 Skill → 查看原文。
- 结果：通过。搜索 `openai` 后列表只保留 `openai-docs`；点击后右侧原文同步切换；“检测到读取”筛选只保留两个带观察信号的 Skill；响应式窄屏布局可读。
- 证据：`docs/product-log/screenshots/preview-v0.1.0-main.png`。

构建验收还覆盖了 TypeScript、2 个 Skill 索引/越权读取测试、单文件 HTML 完整性，以及真实 MCP 客户端握手。真实本机扫描得到 267 个去重 Skill 路径。

## 尚未完成

- 官方未提供 `SkillActivated` 事件，读取观察不能覆盖宿主内部、无工具事件的 Skill 注入。
- 公共插件目录不接受依赖本地 Hook 的完整能力；当前通过公开 GitHub 仓库分发并本机安装。
