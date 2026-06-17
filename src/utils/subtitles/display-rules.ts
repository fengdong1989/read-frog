import type { StateData, SubtitlesFragment } from "./types"
import type { SubtitlesDisplayMode } from "@/types/config/subtitles"

function isSameLanguageSkip(subtitle: SubtitlesFragment | null): boolean {
  return subtitle?.translationSkippedReason === "same-language"
}

function hasResolvedTranslation(subtitle: SubtitlesFragment | null): boolean {
  return !!subtitle?.translation || subtitle?.translationSkippedReason === "same-language"
}

export function getSubtitleLineVisibility(
  subtitle: SubtitlesFragment | null,
  displayMode: SubtitlesDisplayMode,
): { showMain: boolean, showTranslation: boolean } {
  const skippedSameLanguage = isSameLanguageSkip(subtitle)
  const isDuplicateTranslation = !!subtitle?.translation && subtitle.translation === subtitle.text

  return {
    showMain: (displayMode !== "translationOnly" || skippedSameLanguage)
      && !(displayMode === "bilingual" && isDuplicateTranslation),
    showTranslation: displayMode !== "originalOnly"
      && !skippedSameLanguage
      && !(displayMode === "bilingual" && isDuplicateTranslation),
  }
}

export function hasRenderableSubtitleByMode(
  subtitle: SubtitlesFragment | null,
  displayMode: SubtitlesDisplayMode,
): boolean {
  if (!subtitle)
    return false

  if (displayMode === "translationOnly")
    return hasResolvedTranslation(subtitle)

  return true
}

export function isAwaitingTranslation(
  subtitle: SubtitlesFragment | null,
  stateData: StateData | null,
): boolean {
  return subtitle ? !hasResolvedTranslation(subtitle) : stateData?.state === "loading"
}