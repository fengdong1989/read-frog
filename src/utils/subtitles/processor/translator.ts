import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { SubtitlesFragment } from "../types"
import type { Config } from "@/types/config/config"
import type { ProviderConfig } from "@/types/config/provider"
import type { SubtitlePromptContext } from "@/types/content"
import { LANG_CODE_TO_EN_NAME } from "@read-frog/definitions"
import { APICallError } from "ai"
import { i18n } from "#imports"
import { isLLMProviderConfig } from "@/types/config/provider"
import { getProviderConfigById } from "@/utils/config/helpers"
import { getLocalConfig } from "@/utils/config/storage"
import { cleanText } from "@/utils/content/utils"
import { Sha256Hex } from "@/utils/hash"
import { prepareTranslationText } from "@/utils/host/translate/text-preparation"
import { normalizePromptContextValue } from "@/utils/host/translate/translate-text"
import { sendMessage } from "@/utils/message"
import { getSubtitlesTranslatePrompt } from "@/utils/prompts/subtitles"
import {
  getSubtitleLanguageConfig,
  resolveActualSubtitleSourceCode,
  shouldSkipSameLanguageTranslation,
  toSubtitleTranslateLangConfig,
} from "../language-config"

function toFriendlyErrorMessage(error: unknown): string {
  if (error instanceof APICallError) {
    switch (error.statusCode) {
      case 429:
        return i18n.t("subtitles.errors.aiRateLimited")
      case 401:
      case 403:
        return i18n.t("subtitles.errors.aiAuthFailed")
      case 500:
      case 502:
      case 503:
        return i18n.t("subtitles.errors.aiServiceUnavailable")
    }
  }

  const message = error instanceof Error ? error.message : String(error)

  if (message.includes("No Response") || message.includes("Empty response")) {
    return i18n.t("subtitles.errors.aiNoResponse")
  }

  return message
}

export interface SubtitlesVideoContext {
  videoTitle: string
  videoDescription?: string | null
  subtitlesTextContent: string
  summary?: string | null
}

export function buildSubtitlesSummaryContextHash(
  videoContext: Pick<SubtitlesVideoContext, "subtitlesTextContent">,
  providerConfig?: ProviderConfig,
): string | undefined {
  const preparedText = cleanText(videoContext.subtitlesTextContent)
  if (!preparedText) {
    return undefined
  }

  const textHash = Sha256Hex(preparedText)
  return Sha256Hex(textHash, providerConfig ? JSON.stringify(providerConfig) : "")
}

function normalizeSubtitlePromptContext(videoContext: SubtitlesVideoContext): SubtitlePromptContext {
  return {
    webTitle: normalizePromptContextValue(videoContext.videoTitle),
    webDescription: normalizePromptContextValue(videoContext.videoDescription),
    videoSummary: normalizePromptContextValue(videoContext.summary),
  }
}

async function buildSubtitleHashComponents(
  text: string,
  providerConfig: ProviderConfig,
  partialLangConfig: { sourceCode: Config["videoSubtitles"]["sourceCode"], targetCode: Config["videoSubtitles"]["targetCode"] },
  enableAIContentAware: boolean,
  subtitlePromptContext: SubtitlePromptContext,
  subtitlesTextContent: string,
  actualSourceCode?: LangCodeISO6393 | null,
): Promise<string[]> {
  const preparedText = prepareTranslationText(text)
  const normalizedSubtitlesTextContent = normalizePromptContextValue(subtitlesTextContent)
  const hashComponents = [
    preparedText,
    JSON.stringify(providerConfig),
    partialLangConfig.sourceCode,
    partialLangConfig.targetCode,
  ]

  if (actualSourceCode) {
    hashComponents.push(`actualSourceCode:${actualSourceCode}`)
  }

  if (!isLLMProviderConfig(providerConfig)) {
    return hashComponents
  }

  const targetLangName = LANG_CODE_TO_EN_NAME[partialLangConfig.targetCode]
  const promptContext = enableAIContentAware
    ? subtitlePromptContext
    : { ...subtitlePromptContext, videoSummary: undefined }
  const { systemPrompt, prompt } = await getSubtitlesTranslatePrompt(targetLangName, preparedText, {
    isBatch: true,
    context: promptContext,
  })
  hashComponents.push(systemPrompt, prompt)
  hashComponents.push(enableAIContentAware ? "enableAIContentAware=true" : "enableAIContentAware=false")

  if (subtitlePromptContext.webTitle) {
    hashComponents.push(`webTitle:${subtitlePromptContext.webTitle}`)
  }
  if (subtitlePromptContext.webDescription) {
    hashComponents.push(`webDescription:${subtitlePromptContext.webDescription}`)
  }
  if (enableAIContentAware) {
    if (normalizedSubtitlesTextContent) {
      hashComponents.push(`subtitlesTextContent:${normalizedSubtitlesTextContent.slice(0, 1000)}`)
    }
    if (subtitlePromptContext.videoSummary) {
      hashComponents.push(`videoSummary:${subtitlePromptContext.videoSummary}`)
    }
  }

  return hashComponents
}

async function translateSingleSubtitle(
  text: string,
  langConfig: ReturnType<typeof getSubtitleLanguageConfig>,
  providerConfig: ProviderConfig,
  actualSourceCode: LangCodeISO6393 | null,
  enableAIContentAware: boolean,
  videoContext: SubtitlesVideoContext,
): Promise<string> {
  const subtitlePromptContext = normalizeSubtitlePromptContext(videoContext)
  const hashComponents = await buildSubtitleHashComponents(
    text,
    providerConfig,
    { sourceCode: langConfig.sourceCode, targetCode: langConfig.targetCode },
    enableAIContentAware,
    subtitlePromptContext,
    videoContext.subtitlesTextContent,
    actualSourceCode,
  )

  if (enableAIContentAware) {
    const summary = subtitlePromptContext.videoSummary
    hashComponents.push(summary ? "subtitleSummary=ready" : "subtitleSummary=missing")
  }

  return await sendMessage("enqueueSubtitlesTranslateRequest", {
    text,
    langConfig: {
      sourceCode: langConfig.sourceCode,
      targetCode: langConfig.targetCode,
      level: langConfig.level,
    },
    providerConfig,
    scheduleAt: Date.now(),
    hash: Sha256Hex(...hashComponents),
    webTitle: subtitlePromptContext.webTitle,
    webDescription: subtitlePromptContext.webDescription,
    summary: enableAIContentAware ? subtitlePromptContext.videoSummary : undefined,
  })
}

export async function fetchSubtitlesSummary(
  videoContext: SubtitlesVideoContext,
  configOverride?: Config,
): Promise<string | null> {
  const config = configOverride ?? await getLocalConfig()
  if (!config?.translate.enableAIContentAware) {
    return null
  }

  const providerConfig = getProviderConfigById(config.providersConfig, config.videoSubtitles.providerId)

  if (!providerConfig || !isLLMProviderConfig(providerConfig)) {
    return null
  }

  if (!videoContext.videoTitle || !videoContext.subtitlesTextContent) {
    return null
  }

  return await sendMessage("getSubtitlesSummary", {
    videoTitle: videoContext.videoTitle,
    subtitlesContext: videoContext.subtitlesTextContent,
    providerConfig,
  })
}

export async function translateSubtitles(
  fragments: SubtitlesFragment[],
  videoContext: SubtitlesVideoContext,
  sourceLanguageHint?: string,
  configOverride?: Config,
): Promise<SubtitlesFragment[]> {
  const config = configOverride ?? await getLocalConfig()
  if (!config) {
    return fragments.map(f => ({ ...f, translation: "" }))
  }

  const providerConfig = getProviderConfigById(config.providersConfig, config.videoSubtitles.providerId)

  if (!providerConfig) {
    return fragments.map(f => ({ ...f, translation: "" }))
  }

  const langConfig = getSubtitleLanguageConfig(config)
  const actualSourceCode = resolveActualSubtitleSourceCode(langConfig.sourceCode, sourceLanguageHint)
  const enableAIContentAware = !!config.translate.enableAIContentAware

  if (shouldSkipSameLanguageTranslation(langConfig.sourceCode, langConfig.targetCode, actualSourceCode)) {
    return fragments.map(fragment => ({
      ...fragment,
      translation: "",
      translationSkippedReason: "same-language",
    }))
  }

  const translationPromises = fragments.map(fragment =>
    translateSingleSubtitle(
      fragment.text,
      langConfig,
      providerConfig,
      actualSourceCode,
      enableAIContentAware,
      videoContext,
    ),
  )

  const results = await Promise.allSettled(translationPromises)

  const allRejected = results.every((r): r is PromiseRejectedResult => r.status === "rejected")
  if (allRejected && results.length) {
    throw new Error(toFriendlyErrorMessage(results[0].reason))
  }

  return fragments.map((fragment, index) => {
    const result = results[index]
    return {
      ...fragment,
      translation: result.status === "fulfilled" ? result.value : "",
    }
  })
}

export { toSubtitleTranslateLangConfig }