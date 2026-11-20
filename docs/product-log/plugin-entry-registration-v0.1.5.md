# Preview v0.1.5：桌面入口注册修复

## 问题

插件管理器显示 Skill Lens 已安装，但 Codex Desktop 的侧边栏没有出现可打开入口。

## 首个失效环节

Codex Desktop 日志明确报告 `mcp.json` 中的 `cwd: "."` 不满足 Agent Plugins 的安全路径规则，因此忽略了 `skill-lens` MCP server。安装状态成功不等于运行时加载成功。

## 修复

- `mcp.json` 与兼容清单 `.mcp.json` 的 `cwd` 统一改为 `${PLUGIN_ROOT}`。
- 版本提升到 `0.1.5`，用于强制本地 marketplace 重新安装并刷新缓存。
- 桌面验收以“宿主加载工具 + 用户可打开 GUI + 实际截图”为完成条件。

## 保持不变

- Skill 读取、Session 跟随、固定 Session、自动更新与展示型边界不变。
- 不增加编辑、搜索或管理 Skill 的能力。

## 后续修正：v0.1.6

真实桌面验收发现 `global` 入口会打开独立主页面，不符合“随当前 conversation 常驻右侧面板”的产品目标。v0.1.6 因此只保留 `thread` 入口，并将首选展示模式调整为 `pip`。

## 实机纠正：v0.1.7

用户在 Codex Desktop 的右侧面板来源选择器中复核后，确认其中没有 Skill Lens。当前宿主虽然能读取 `thread` 声明，但没有在该 Codex 面板展示第三方入口。v0.1.7 恢复 `global` 作为目前唯一可见入口，并明确：右侧常驻面板仍未真实交付。
