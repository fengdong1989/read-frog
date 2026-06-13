# AGENT.md — 对话启动协议（最高优先级）

> **每次对话的第一件事**：在写代码、改 bug、做功能优化之前，必须先阅读本目录文档，并对照 [INVARIANTS.md](./INVARIANTS.md) 做拓扑合规检查。
>
> 违反拓扑不变量会导致**跨节点穿透调用**，进而引发限流击穿、缓存不一致、CORS/密钥泄露、队列拥塞等系统性故障。

## 阅读顺序（强制）

| 顺序 | 文件 | 用途 |
|------|------|------|
| 1 | [INVARIANTS.md](./INVARIANTS.md) | **铁律** — 12 条不可违反的拓扑不变量 |
| 2 | [TOPOLOGY.md](./TOPOLOGY.md) | 运行时节点图、入口点职责、通信总线 |
| 3 | [BOUNDARY-GATES.md](./BOUNDARY-GATES.md) | I/O 边界门 — 特定操作只能在哪些文件发生 |
| 4 | [CALL-CHAINS.md](./CALL-CHAINS.md) | 四大业务的合法调用链（改代码前对照） |

## 改动前自检清单（Pre-flight）

在提交任何 patch 前，逐项确认：

- [ ] **未在 `*.content` 中新增** `executeTranslate` / `aiTranslate` / `generateText` / `streamText` 直接调用
- [ ] **未在 content script 中新增** 对 AI / DeepL / Microsoft / Google 翻译 API 的裸 `fetch`
- [ ] **未在 content script 中新增** Dexie 写入（`db.*.put/add/update/delete`）
- [ ] **跨上下文通信** 仅通过 `src/utils/message.ts` 的 `ProtocolMap`（`sendMessage` / `onMessage`）或已登记的 port 流
- [ ] **跨域 HTTP** 在 isolated world 中仅通过 `backgroundFetch`（`src/utils/content-script/background-fetch-client.ts`）
- [ ] **批量翻译** 走 `enqueueTranslateRequest` 或 `enqueueSubtitlesTranslateRequest`，不绕过 `translation-queues.ts`
- [ ] **utils 层未反向依赖** `src/entrypoints/`（禁止 `utils → entrypoints` 循环）
- [ ] **MAIN world 脚本**（`interceptor.content`、`input-injector.content`）未使用 `chrome.runtime` / `sendMessage`
- [ ] 新增消息类型已同步更新 `src/utils/message.ts` 的 `ProtocolMap` 及 background `onMessage` 注册
- [ ] 若改动涉及扩展页直连 API（`translation-hub`、`options` 连接测试），已确认这是**有意豁免**路径且不影响 content 拓扑

## 系统节点速览

```
Extension Pages          Content (ISOLATED)         Content (MAIN)        Background SW
─────────────────        ───────────────────        ──────────────        ─────────────
popup                    host.content               interceptor.content   index.ts (hub)
options                  selection.content          input-injector.content translation-queues
translation-hub          side.content                                     proxy-fetch
sidepanel                subtitles.content                                background-stream
                         guide.content                                    llm-generate-text
                                                                            edge-tts / tts-playback
Offscreen: offscreen/main.ts (仅音频播放)
```

**唯一消息总线**：`src/utils/message.ts`

**唯一队列枢纽**：`src/entrypoints/background/translation-queues.ts`

## 允许的「豁免」直连路径（已知且有意）

以下路径**不经过 RequestQueue**，是产品设计使然，新增类似路径需维护者评审：

| 路径 | 文件 | 原因 |
|------|------|------|
| 划词 LLM 流式翻译 | `selection.content` → port → `background-stream.ts` | 实时 UI，不走批量队列 |
| 翻译实验室 | `translation-hub/translation-card.tsx` → `executeTranslate` | 扩展页调试工具 |
| 服务商连接测试 | `options/connection-button.tsx` → `executeTranslate` | 单次探活 |
| 语言检测 | `backgroundGenerateText` → `llm-generate-text.ts` | 短文本，无队列 |

**禁止**将上述豁免模式复制到 `host.content` / `subtitles.content` / `side.content`。

## 与根目录 AGENTS.md 的关系

- `AGENTS.md`（根目录）：测试环境注意事项（`SKIP_FREE_API`）
- `AGENT.md/`（本目录）：**架构拓扑与不变量** — 优先级更高，改动代码前必读

## 版本锚点

- 拓扑文档基于仓库 `main` @ v1.34.1 梳理
- 入口点变更、新增 `ProtocolMap` 消息、新增 I/O 门时，**必须同步更新本目录**