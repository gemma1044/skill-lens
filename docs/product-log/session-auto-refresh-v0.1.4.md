# Preview v0.1.4：Session 感知自动更新

## 交付目标

让 Skill Lens 在保持只读检查器边界的前提下，自动跟随当前 Session 的 Skill 读取变化，并允许用户在检查特定上下文时固定原 Session。

## 验证

- `npm run check`：类型检查、4 个确定性测试和生产构建全部通过。
- 浏览器真实数据预览：页面在 2.5 秒轮询周期内请求一次轻量状态接口，显示“自动更新”。
- 交互：点击“跟随当前”后切换为“固定此 Session”。
- 截图：[`screenshots/session-auto-refresh-v0.1.4.png`](./screenshots/session-auto-refresh-v0.1.4.png)

## 证据边界

自动更新仍然基于本地 Session JSONL 与 Hook 中可核对的 `SKILL.md` 读取，不等同于 Codex 官方 `SkillActivated` 事件。真实 Codex 侧边栏入口和安装版本在合并后另行验收。
