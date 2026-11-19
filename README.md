# Skill Lens

Skill Lens 是一个本机 Codex Desktop 插件：默认只展示当前 Session 中检测到读取的 Skill，同时保留全部 Skill 目录、来源与完整 `SKILL.md` 查看。

## 正确打开方式

安装并启用后，直接点击 Codex 侧边栏里的 **Skill Lens**。面板会立即显示当前 Session 检测到读取的 Skill，不需要在聊天框中输入“Skill Lens”、`@Skill Lens` 或“帮我查 Skill”。在聊天里提到产品名只会让 Codex 把它当作普通消息处理，不会打开 GUI。

默认“当前 Session”页面是纯展示列表，不出现搜索和筛选。只有主动切换到“全部 Skill”目录后，才提供本地搜索，方便在完整目录中定位文件；它不会向 Codex 发起查询。

> 当前 Codex Hooks 没有公开 `SkillActivated` 事件。界面中的“检测到读取”表示本地 Hook 观察到一次成功工具调用引用了 `SKILL.md`，不等同于官方激活确认。

## 功能

- Codex 全局侧边栏与会话侧栏入口
- “当前 Session”默认视图，只列出本会话内有读取证据的 Skill
- “全部 Skill”次级目录，扫描个人、项目和插件 Skill
- 搜索、来源筛选和全文查看
- 从当前 Codex Session 的本地工具调用日志回溯已发生的 `SKILL.md` 读取
- 本地 `PostToolUse` Hook 观察 `SKILL.md` 读取
- 只读设计：不会修改任何 Skill

## 本地运行

```bash
npm install
npm run check
npm run preview
```

打开 <http://localhost:4173/preview.html> 查看独立预览。

## 安装到 Codex Desktop

```bash
codex plugin marketplace add /absolute/path/to/skill-lens
codex plugin add skill-lens@skill-lens-local
```

重启 ChatGPT Desktop，在 Plugins Directory 的 **Skill Lens Local** 来源中启用插件。首次启用 Hook 时，Codex 会要求你审阅并信任本地 Hook 定义。

如需扫描额外目录，在插件的 MCP 环境中设置以系统路径分隔符连接的 `SKILL_LENS_ROOTS`。默认会扫描：

- `~/.codex/skills`
- `~/.agents/skills`
- `~/.codex/plugins`
- 当前工作区的 `.agents/skills` 和 `.codex/skills`

## 安全边界

- `skillLens.read` 只允许读取当前扫描结果中的路径。
- Hook 仅向插件私有 `PLUGIN_DATA/activity.jsonl` 追加最小事件字段。
- 插件自己的 `skillLens.read` 不计入活动，避免“用户查看 Skill”污染“Codex 当前读取”的判断。
- 当前 Session 归因优先使用 Codex 的 `CODEX_THREAD_ID`，并兼容工具调用中的 `openai/session` 元数据；两者都不可用时会显示明确空状态。
- 会话日志只解析当前 Session 的工具调用事件，不解析聊天正文；不会上传 Skill 内容，也不包含凭据。

## 开发状态

当前版本：`preview-v0.1.5`。产品计划、视觉规范和里程碑记录分别位于 `docs/plans/`、`docs/design-system/` 与 `docs/product-log/`。

## License

MIT
