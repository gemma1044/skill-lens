# Changelog

## Preview v0.1.2 — Session 日志回溯

- 从当前 Codex Session 的本地工具调用日志恢复已经发生的 `SKILL.md` 读取，不再只依赖启用后的 Hook。
- 当前会话预览从错误的 0 项恢复为 10 项真实记录。
- 仅解析工具调用事件，并继续排除 Skill Lens 自身全文查看造成的归因污染。

## Preview v0.1.1 — 当前 Session 视图

- 默认仅显示当前 Session 中由 Hook 观测到读取的 Skill。
- 将全量扫描结果移入“全部 Skill”，并区分当前读取与历史读取。
- 当前会话无证据或无法识别时显示明确空状态，不再把已安装 Skill 当作已加载 Skill。

## Preview v0.1.0 — Skill 可视化工作台

- 新增 Codex 全局侧边栏和会话侧栏入口。
- 新增本地 Skill 扫描、搜索、来源筛选和完整 `SKILL.md` 查看。
- 新增基于 `PostToolUse` 的读取观察日志，并明确区分推断与官方激活事件。
- 唯一产品入口：安装插件后，从 Codex 侧边栏打开 **Skill Lens**。
