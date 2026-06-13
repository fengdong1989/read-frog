# I/O 边界门（Boundary Gates）

**边界门** = 某类 I/O 或跨节点操作**唯一合法**发生的文件/模块。改动时若需新增 I/O，必须扩展现有门或在 background 新建门并注册消息，禁止在调用链中间插入新的 I/O 节点。

---

## 消息与协议

| 门 | 路径 | 允许的操作 |
|----|------|------------|
| 协议定义 | `src/utils/message.ts` | 声明 `ProtocolMap` 全部消息签名 |
| Handler 注册 | `src/entrypoints/background/index.ts` | `onMessage` / `onConnect` 总注册 |
| 子 handler | `background/translation-queues.ts`, `proxy-fetch.ts`, `background-stream.ts`, `edge-tts.ts`, `tts-playback.ts`, `llm-generate-text.ts`, `ai-segmentation.ts`, `translation-signal.ts` | 各领域消息实现 |

---

## 翻译 Provider I/O

| 门 | 路径 | 允许的操作 |
|----|------|------------|
| Provider 分发 | `src/utils/host/translate/execute-translate.ts` | 路由到 ai/google/microsoft/deepl/deeplx |
| AI 批量翻译 | `src/utils/host/translate/api/ai.ts` | `generateText`（仅被 executeTranslate 调用） |
| 免费 API | `api/google.ts`, `api/microsoft.ts` | 裸 fetch（仅 background 上下文安全） |
| 代理 API | `api/deepl.ts`, `api/deeplx.ts` | 经 `backgroundFetch` |
| 队列入队（content 侧） | `src/utils/host/translate/translate-text.ts` | `translateTextCore` → `enqueueTranslateRequest` |
| 队列调度 | `src/entrypoints/background/translation-queues.ts` | RQ/BQ + Dexie 读写 + executeTranslate |

### 扩展页豁免门（不经过队列，禁止复制到 content）

| 门 | 路径 | 场景 |
|----|------|------|
| 翻译实验室 | `translation-hub/components/translation-card.tsx` | 多服务商对比实验 |
| 连接测试 | `options/.../connection-button.tsx` | 单次 `executeTranslate("Hi", ...)` |

---

## 流式 LLM

| 门 | 路径 | 允许的操作 |
|----|------|------------|
| 客户端 | `src/utils/content-script/background-stream-client.ts` | `streamBackgroundText` |
| Port 基建 | `src/utils/content-script/port-streaming.ts` | connect / chunk / done |
| 服务端 | `src/entrypoints/background/background-stream.ts` | AI SDK `streamText` |
| 消费方 | `selection.content/.../provider.tsx` | 划词流式 UI |

---

## 网络代理

| 门 | 路径 | 允许的操作 |
|----|------|------------|
| 客户端 | `src/utils/content-script/background-fetch-client.ts` | 封装 `sendMessage("backgroundFetch")` |
| 服务端 | `src/entrypoints/background/proxy-fetch.ts` | 带 Cookie 的 fetch + SessionCache |
| 缓存注册 | `src/utils/session-cache/session-cache-group-registry.ts` | 缓存组 CRUD |

### 经 backgroundFetch 的已知客户端

- `src/utils/orpc/client.ts`
- `src/utils/auth/auth-client.ts`
- `src/utils/host/translate/api/deepl.ts`
- `src/utils/host/translate/api/deeplx.ts`
- `src/utils/iconify/setup-background-fetch.ts`

---

## ORPC 后端 API

| 门 | 路径 | 上下文 | 允许的操作 |
|----|------|--------|------------|
| UI/Content 客户端 | `src/utils/orpc/client.ts` | popup, content, options | 经 backgroundFetch 代理 |
| Background 客户端 | `src/utils/orpc/background-client.ts` | **仅 background** | 原生 fetch + credentials |
| 待保存处理 | `src/entrypoints/background/notebase-pending-save.ts` | background | Notebase 同步 |

---

## 持久化存储

| 门 | 路径 | 读/写 | 表 |
|----|------|-------|-----|
| Dexie 定义 | `src/utils/db/dexie/db.ts` | — | schema |
| 翻译缓存写 | `background/translation-queues.ts` | W | `translationCache`, `articleSummaryCache` |
| 分段缓存写 | `background/ai-segmentation.ts` | W | `aiSegmentationCache` |
| 批量记录写 | `utils/batch-request-record.ts` | W | `batchRequestRecord` |
| 清理 | `background/db-cleanup.ts` | W | 全表清理 |
| 统计只读 | `options/pages/statistics/**` | R | `batchRequestRecord` |

---

## TTS

| 门 | 路径 | 步骤 |
|----|------|------|
| 合成 | `background/edge-tts.ts` | `edgeTtsSynthesize` → Edge 服务 |
| 播放路由 | `background/tts-playback.ts` | 确保 offscreen + 路由音频 |
| 实际播放 | `offscreen/main.ts` | `HTMLAudioElement` |

---

## 配置与环境

| 门 | 路径 | 说明 |
|----|------|------|
| 环境变量 | `src/env/index.ts` | `@t3-oss/env-core` 校验 |
| 构建守门 | `wxt.config.ts` | 禁止生产打包 `WXT_*_API_KEY` |
| 用户配置 | `src/utils/config/storage.ts` | WXT local storage |

---

## 新增 I/O 的合规流程

1. 判断 I/O 类型（翻译 / fetch / 存储 / 流式）
2. 找到上表对应边界门
3. 若现有门不支持：
   - 在 **background** 扩展 handler
   - 在 `ProtocolMap` 添加消息类型
   - 在 content 侧仅添加 `sendMessage` 客户端封装
4. 更新 `AGENT.md/INVARIANTS.md` 与 `CALL-CHAINS.md`
5. 运行 INVARIANTS 中的违规检测命令