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
