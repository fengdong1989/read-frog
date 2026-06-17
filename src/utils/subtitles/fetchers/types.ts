import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { SubtitlesFragment } from "@/utils/subtitles/types"

export interface SubtitlesFetcher {
  fetch: () => Promise<SubtitlesFragment[]>
  cleanup: () => void
  shouldUseSameTrack: () => Promise<boolean>
  getSourceLanguage: () => string
  hasAvailableSubtitles: () => Promise<boolean>
  setPreferredSourceCode?: (code: LangCodeISO6393 | "auto") => void
  isPreSegmented?: () => boolean
}
