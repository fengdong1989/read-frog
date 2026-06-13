# 拓扑不变量（铁律）

以下规则是系统稳定性的**硬约束**。任何功能优化或 BUG 修复不得违反；若业务需求似乎需要破例，应先扩展 `ProtocolMap` 并在 background 注册门控 handler，而非在下游节点直接调用上游 I/O。

---

## INV-01：Content Script 禁止直连 Provider I/O

**规则**：`src/entrypoints/*.content/**` 不得 import 或调用：

- `executeTranslate` / `aiTranslate`（`src/utils/host/translate/execute-translate.ts`, `api/ai.ts`）
- `generateText` / `streamText`（`ai` 包）
- `api/google.ts`, `api/microsoft.ts` 中的翻译函数

**合法替代**：

- 批量翻译 → `translateTextCore` → `sendMessage("enqueueTranslateRequest")`
- 流式划词 → `streamBackgroundText` → port → `background-stream.ts`
- 短 LLM 文本 → `sendMessage("backgroundGenerateText")`

**击穿后果**：绕过 RequestQueue/BatchQueue 限流去重 → API 配额击穿；密钥/CORS 暴露在页面上下文。

---

## INV-02：翻译工作必须经 Background 队列（豁免见 INV-10）

**规则**：页面翻译与字幕翻译的 Provider 调用必须由 `translation-queues.ts` 调度：

- 网页：`enqueueTranslateRequest` → `setUpWebPageTranslationQueue`
- 字幕：`enqueueSubtitlesTranslateRequest` → `setUpSubtitlesTranslationQueue`

队列内部路径：`Dexie 缓存读` → `BatchQueue`（LLM）/ `RequestQueue` → `executeTranslate` → `Dexie 缓存写`

**击穿后果**：并发 DOM 遍历产生海量并行请求 → 服务商 429 → 全站翻译瘫痪。

---

## INV-03：Isolated World 跨域 HTTP 仅经 backgroundFetch

**规则**：content script、popup 等 isolated 上下文中，对扩展域外 URL 的 `fetch` 必须经：

```
sendMessage("backgroundFetch") → proxy-fetch.ts → SessionCacheGroupRegistry
```

ORPC 客户端（`src/utils/orpc/client.ts`）、Auth（`auth-client.ts`）、DeepL/DeepLX API 已遵循此模式。

**击穿后果**：CORS 失败、Cookie 无法携带、绕过 HTTP 缓存失效策略。

---

## INV-04：Dexie 写入权归属 Background

**规则**：`src/utils/db/dexie/db.ts` 的 **写操作**（put/add/update/delete/clear）仅允许在：

- `src/entrypoints/background/**`
- `src/utils/batch-request-record.ts`（由 background 队列触发）

`options` 页仅允许**只读**统计查询。Content script **禁止** import `db`。

**当前写入点**：`translation-queues.ts`, `ai-segmentation.ts`, `db-cleanup.ts`, `mock-data.ts`

**击穿后果**：多上下文并发写 IndexedDB → 缓存脏读、去重 hash 失效。

---

## INV-05：页面翻译状态由 Background 独占写入

**规则**：Tab 级「页面翻译开关」持久化与广播由 `translation-signal.ts` 管理。

- Content 通过 `setAndNotifyPageTranslationStateChangedByManager` 上报
- 仅 top frame 可写 enabled 状态
- 其他 UI（popup、side.content）通过 `tryToSet*` / `askManagerToToggle*` 间接操作

**击穿后果**：iframe 与 top frame 状态分裂 → 重复注入或翻译丢失。

---

## INV-06：单一消息协议（ProtocolMap）

**规则**：跨扩展上下文 RPC **仅**通过 `src/utils/message.ts` 的 `ProtocolMap`。

- 禁止新建平行的 `chrome.runtime.sendMessage` 字符串协议
- 新增能力 = 扩展 `ProtocolMap` + background `onMessage` 注册

**击穿后果**：类型漂移、handler 遗漏、难以审计的隐式耦合。

---

## INV-07：MAIN World 脚本零扩展 API

**规则**：`interceptor.content`、`input-injector.content` 运行在 `world: "MAIN"`：

- 禁止 `sendMessage`、`chrome.runtime`、`browser.runtime`
- 仅允许 DOM 操作 + `window.postMessage` 与 isolated world 通信

**击穿后果**：MAIN world 无扩展 API → 运行时崩溃；或误将页面 JS 与扩展混淆。

---

## INV-08：依赖方向单向 — utils 不得依赖 entrypoints

**规则**：

```
entrypoints → utils → types
types/env   → （不依赖 entrypoints、不依赖 I/O）
```

**禁止**：`src/utils/**`（生产代码）import `src/entrypoints/**`

**已知例外**（仅测试/mock，不得扩散）：

- `src/utils/request/__tests__/*.test.ts` → import `parseBatchResult` from background
- `src/utils/db/dexie/mock-data.ts` → import cleanup 常量 from background

**击穿后果**：循环依赖、构建顺序不确定、测试无法隔离。

---

## INV-09：TTS 调用链固定四跳

**规则**：UI → `edgeTtsSynthesize`（background）→ `ttsPlaybackStart`（background）→ `ttsOffscreenPlay`（offscreen）

禁止在 content script 中直接 `new Audio()` 播放 Edge TTS 返回的音频（除非已有豁免代码路径）。

**击穿后果**：Offscreen 文档未创建 → 播放失败；多上下文音频竞争。

---

## INV-10：已知豁免路径不得扩散

**规则**：以下直连 Provider 的路径是**有意设计**，**不得**作为模板复制到 content script：

| 豁免 | 位置 |
|------|------|
| 流式划词 LLM | `selection.content` → port → `background-stream.ts` |
| 翻译实验室 | `translation-hub/components/translation-card.tsx` |
| 连接测试 | `options/.../connection-button.tsx` |
| 语言检测 | `backgroundGenerateText` → `llm-generate-text.ts` |

**击穿后果**：每增加一条豁免 = 多一个无限流 I/O 入口 → 系统性击穿风险指数增长。

---

## INV-11：网页队列与字幕队列隔离

**规则**：`setUpWebPageTranslationQueue` 与 `setUpSubtitlesTranslationQueue` 各自持有独立的 `RequestQueue` + `BatchQueue` 实例。

禁止共用同一队列实例，避免字幕批量任务阻塞页面 DOM 翻译。

---

## INV-12：生产构建禁止打包 WXT_*_API_KEY

**规则**：`wxt.config.ts` 在 production 构建时检测 `WXT_*_API_KEY` 环境变量（`WXT_POSTHOG_API_KEY` 除外）。

禁止在客户端代码中硬编码 API Key；开发密钥放 `.env.development`。

---

## 违规检测命令（本地审计）

```bash
# Content script 是否违规 import executeTranslate / aiTranslate
rg "executeTranslate|aiTranslate|generateText|streamText" src/entrypoints --glob "*.content/**"

# Content script 是否直接写 Dexie
rg "from \"@/utils/db" src/entrypoints --glob "*.content/**"

# utils 是否反向依赖 entrypoints
rg "from \"@/entrypoints" src/utils

# 是否存在平行 sendMessage 字符串协议（应极少）
rg "runtime\.sendMessage\(" src --glob "!**/__tests__/**"
```

期望：`*.content` 中无 executeTranslate/aiTranslate；无 Dexie 写；utils 无 entrypoints 依赖。