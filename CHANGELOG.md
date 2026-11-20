# Changelog

## Preview v0.1.7 — 恢复可见入口并纠正侧栏能力边界

- 恢复 `global` 入口，避免当前 Codex Desktop 因不展示第三方 `thread` 入口而无处打开 Skill Lens。
- 保留 `thread` 声明，为宿主后续支持 conversation panel 做准备。
- 撤回错误的一页说明书：当前 Codex 右侧面板来源选择器没有 Skill Lens，不能声称侧栏入口已经可用。

## Preview v0.1.6 — 改为当前会话侧边面板

- 移除会占据主工作区的 `global` 入口，只保留当前 conversation 的 `thread` 入口。
- UI 资源首选展示模式从 `fullscreen` 改为 `pip`，让 Skill Lens 打开在聊天右侧面板。
- 更新 UI 资源 URI，避免桌面端继续使用旧的全屏缓存。

## Preview v0.1.5 — 修复桌面插件入口注册

- 将本地 MCP 进程工作目录改为宿主允许的 `${PLUGIN_ROOT}`，避免插件安装后被 Codex 忽略。
- 补充真实桌面启动验收：只有 Skill Lens 工具成功加载并出现可打开的 GUI 入口，才算安装完成。

## Preview v0.1.4 — Session 感知自动更新

- 面板可见时每 2.5 秒检查一次轻量活动版本；只有 Session 或活动发生变化时才重新扫描完整 Skill 目录。
- 当前 Session 新读取 `SKILL.md` 后，列表自动更新；面板重新获得焦点或宿主上下文变化时立即核对。
- 新增“跟随当前 / 固定此 Session”模式，允许全局入口跟随当前对话，也允许检查期间锁定原 Session。
- 自动更新失败时保留上一次可用结果并显示明确状态，手动刷新入口继续保留。

## Preview v0.1.3 — 纯展示插件入口

- 明确 Skill Lens 只能从 Codex 侧边栏直接打开，不需要在聊天中输入产品名或发起查询。
- 当前 Session 默认页移除搜索与来源筛选，只展示本会话检测到读取的 Skill。
- 搜索保留在“全部 Skill”目录中，作为面板内的本地定位能力。
- 入口与数据工具继续保持 `app-only`，不向模型暴露为会话查询工具。

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
