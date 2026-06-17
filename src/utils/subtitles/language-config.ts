import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { Config } from "@/types/config/config"
import { resolveLanguageCodeFromLocale } from "@/utils/content/page-language"

export interface SubtitleLanguageConfig {
  sourceCode: Config["videoSubtitles"]["sourceCode"]
  targetCode: Config["videoSubtitles"]["targetCode"]
  level: Config["language"]["level"]
}

export function getSubtitleLanguageConfig(config: Config): SubtitleLanguageConfig {
  return {
    sourceCode: config.videoSubtitles.sourceCode,
    targetCode: config.videoSubtitles.targetCode,
    level: config.language.level,
  }
}

export function toSubtitleTranslateLangConfig(config: Config): Config["language"] {
  const subtitleLanguage = getSubtitleLanguageConfig(config)
  return {
    ...config.language,
    sourceCode: subtitleLanguage.sourceCode,
    targetCode: subtitleLanguage.targetCode,
  }
}

export function resolveActualSubtitleSourceCode(
  configuredSourceCode: SubtitleLanguageConfig["sourceCode"],
  sourceLanguageHint?: string,
): LangCodeISO6393 | null {
  if (configuredSourceCode !== "auto") {
    return configuredSourceCode
  }

  return resolveLanguageCodeFromLocale(sourceLanguageHint)
}

export function shouldSkipSameLanguageTranslation(
  configuredSourceCode: SubtitleLanguageConfig["sourceCode"],
  targetCode: SubtitleLanguageConfig["targetCode"],
  actualSourceCode: LangCodeISO6393 | null,
): boolean {
  if (configuredSourceCode !== "auto") {
    return configuredSourceCode === targetCode
  }

  return actualSourceCode === targetCode
}