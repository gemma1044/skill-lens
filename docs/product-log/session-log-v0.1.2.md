# Session 日志回溯 v0.1.2

## 用户纠正

当前 Session 明确执行过多个 Skill，但 v0.1.1 的本地预览仍显示 0。这个 0 只代表 Hook 私有日志为空，不代表当前会话没有读取 Skill。

## 根因

`PostToolUse` Hook 只能记录启用并重启 Codex 之后的新工具调用，无法回溯当前会话前面已经发生的读取。把 Hook 空日志直接呈现为“当前 Session 0”会造成错误结论。

## 修正

- 用当前 `CODEX_THREAD_ID` 定位 `~/.codex/sessions` 中对应的 rollout JSONL。
- 只解析 `response_item` 中的工具调用事件，从调用输入提取真实 `SKILL.md` 路径。
- 将 Session 日志记录与 Hook 记录合并、按时间排序，再与扫描到的真实 Skill 路径核对。
- 排除 `skillLens.read`，防止用户在目录里查看全文后污染“Codex 当前读取”的判断。
- 不解析聊天消息正文，也不把本地内容上传到外部服务。

## 真实验收

同一个当前 Session 在修正前显示 0 项；修正后显示 10 项，包括 `repo-view`、`codex-deskpad-sync`、`frontend-design`、`git-branch-safety`、`openai-docs`、`code-reality-first` 与 `product-plan-gate`，并显示各自读取时间和完整正文。
