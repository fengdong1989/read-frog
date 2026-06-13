# 关键调用链（合法路径）

改动以下业务时，**必须**保持调用链完整，不得在链中插入旁路或跳过节点。

---

## 1. 整页翻译（host.content）

```
host.content/index.tsx
  └─ bootstrapHostContent (runtime.ts)
       └─ PageTranslationManager (page-translation.ts)
            ├─ sendMessage("setAndNotifyPageTranslationStateChangedByManager")
            │    └─ background/translation-signal.ts  [状态持久化]
            └─ IntersectionObserver / MutationObserver
                 └─ translateWalkedElement (node-manipulation.ts)
                      └─ translateTextForPage (translate-variants.ts)
                           └─ translateTextCore (translate-text.ts)
                                └─ sendMessage("enqueueTranslateRequest")  ◀── 入队点
                                     └─ background/translation-queues.ts
                                          ├─ db.translationCache.get        [Dexie 读]
                                          ├─ BatchQueue (LLM) / RequestQueue
                                          │    └─ executeTranslate
                                          │         └─ aiTranslate | google | microsoft | deepl(x)
                                          └─ db.translationCache.put        [Dexie 写]
```

### 上下文感知摘要（可选）

```
webpage-summary.ts
  └─ sendMessage("getOrGenerateWebPageSummary")
       └─ translation-queues.ts → getOrGenerateWebPageSummary
            ├─ db.articleSummaryCache
            └─ RequestQueue → generateArticleSummary → executeTranslate
```

**禁止捷径**：host.content 直接 `executeTranslate` 或 `fetch` 翻译 API。

---

## 2. 划词翻译（selection.content）

### 路径 A — LLM 流式（豁免，不经 RequestQueue）

```
selection.content/translate-button/provider.tsx
  └─ streamBackgroundText (background-stream-client.ts)
       └─ createPortStreamPromise (port-streaming.ts)
            └─ runtime.connect("streamText")
                 └─ background/background-stream.ts
                      └─ AI SDK streamText
```

### 路径 B — 非 LLM / 队列式 LLM

```
provider.tsx
  └─ translateTextCore (translate-text.ts)
       └─ sendMessage("enqueueTranslateRequest")
            └─ [同整页翻译队列链]
```

### 上下文菜单唤起

```
background/context-menu.ts
  └─ sendMessage("openSelectionTranslationFromContextMenu") → selection.content
```

**禁止捷径**：在 provider 中新增 `executeTranslate` 调用（实验室模式除外）。

---

## 3. 字幕翻译（subtitles.content）

```
subtitles.content/index.tsx
  └─ initYoutubeSubtitles
       ├─ interceptor.content (MAIN) ──DOM hooks──▶ 字幕源数据
       └─ universal-adapter / YouTube platform
            └─ translateSubtitles (utils/subtitles/processor/translator.ts)
                 ├─ sendMessage("enqueueSubtitlesTranslateRequest")  ◀── 字幕入队点
                 │    └─ translation-queues.ts (Subtitles RQ/BQ)
                 ├─ sendMessage("getSubtitlesSummary")
                 ├─ sendMessage("aiSegmentSubtitles")
                 │    └─ background/ai-segmentation.ts → Dexie
                 └─ sendMessage("microsoftBatchTranslate")  [warmup 路径]
```

**禁止捷径**：subtitles.content 直接 import `execute-translate.ts`。

---

## 4. TTS（跨三上下文）

```
hooks/use-text-to-speech.tsx  (selection / UI)
  ├─ sendMessage("edgeTtsSynthesize")
  │    └─ background/edge-tts.ts → Edge TTS 服务
  └─ sendMessage("ttsPlaybackStart")
       └─ background/tts-playback.ts
            └─ sendMessage("ttsOffscreenPlay")
                 └─ offscreen/main.ts → HTMLAudioElement.play()
```

**禁止捷径**：content script 直接 fetch Edge TTS URL 并播放。

---

## 5. 语言检测（短 LLM 文本）

```
utils/content/language.ts
  └─ sendMessage("backgroundGenerateText")
       └─ background/llm-generate-text.ts
            └─ AI SDK generateText  (无 RequestQueue，短文本豁免)
```

---

## 6. 用户配置变更

```
options / popup
  └─ utils/config/storage.ts (WXT local storage)
       └─ [读取方] host.content / background ensureInitializedConfig
```

配置变更**不**经消息总线（除 `clearAllTranslationRelatedCache` 等显式 cache 消息）。

---

## 7. 悬浮按钮 / 侧栏（side.content）

```
side.content
  ├─ sendMessage("askManagerToTogglePageTranslation") → host.content 翻译开关
  ├─ sendMessage("toggleSidePanel") → background/side-panel.ts
  └─ site-control 检查 (与 host.content 共享 utils/site-control.ts)
```

---

## 击穿模式对照（改代码时禁止）

| 错误改法 | 击穿的节点 | 后果 |
|----------|------------|------|
| host 直接 `executeTranslate` | 跳过 RQ/BQ + Dexie | API 限流击穿 |
| selection 新增裸 `fetch(openai)` | 跳过 backgroundFetch | CORS / 密钥暴露 |
| subtitles 写 `db.translationCache` | 跨上下文 Dexie 写 | 缓存不一致 |
| utils  import entrypoints | 依赖环 | 构建/测试崩溃 |
| 新增第三个独立翻译队列实例 | 资源竞争 | 不可预测的限流 |
| MAIN world 使用 sendMessage | 无扩展 API | 运行时异常 |

---

## 改动影响半径速查

| 你改的文件 | 必须同步检查 |
|------------|--------------|
| `message.ts` | background 全部 `onMessage`、所有 `sendMessage` 调用方 |
| `translation-queues.ts` | host.content, subtitles, translate-text.ts, options 队列配置 |
| `execute-translate.ts` | 所有 Provider、队列测试、connection-button |
| `translate-text.ts` | host, selection, 一切 enqueue 调用方 |
| `background-stream.ts` | selection provider, port-streaming.ts |
| `proxy-fetch.ts` | orpc/client, auth-client, deepl(x), SessionCacheRegistry |
| `translation-signal.ts` | host, side, popup, 所有页面状态 UI |