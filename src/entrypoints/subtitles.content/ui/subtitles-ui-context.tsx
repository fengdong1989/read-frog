import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { ControlsConfig } from "@/entrypoints/subtitles.content/platforms"
import type { UniversalVideoAdapter } from "@/entrypoints/subtitles.content/universal-adapter"
import { Provider as JotaiProvider } from "jotai"
import { createContext, use } from "react"
import { subtitlesStore } from "../atoms"

interface SubtitlesUIContextValue {
  toggleSubtitles: (enabled: boolean) => void
  downloadSourceSubtitles: () => Promise<void>
  downloadTranslatedSubtitles: () => Promise<void>
  refreshSubtitleTranslation: () => void
  detectedSourceLangCode?: LangCodeISO6393
  controlsConfig?: ControlsConfig
  embedded?: boolean
}

export const SubtitlesUIContext = createContext<SubtitlesUIContextValue | null>(null)

export function useSubtitlesUI() {
  const ui = use(SubtitlesUIContext)
  if (!ui) {
    throw new Error("useSubtitlesUI must be used within SubtitlesUIContext")
  }
  return ui
}

export type SubtitlesProvidersAdapter = Pick<
  UniversalVideoAdapter,
  | "downloadSourceSubtitles"
  | "downloadTranslatedSubtitles"
  | "embedded"
  | "getControlsConfig"
  | "getDetectedSourceLangCode"
  | "refreshSubtitleTranslation"
  | "toggleSubtitlesManually"
>

export function SubtitlesProviders({
  adapter,
  children,
}: {
  adapter: SubtitlesProvidersAdapter
  children: React.ReactNode
}) {
  return (
    <JotaiProvider store={subtitlesStore}>
      <SubtitlesUIContext
        value={{
          toggleSubtitles: adapter.toggleSubtitlesManually,
          downloadSourceSubtitles: adapter.downloadSourceSubtitles,
          downloadTranslatedSubtitles: adapter.downloadTranslatedSubtitles,
          refreshSubtitleTranslation: adapter.refreshSubtitleTranslation,
          detectedSourceLangCode: adapter.getDetectedSourceLangCode(),
          controlsConfig: adapter.getControlsConfig(),
          embedded: adapter.embedded,
        }}
      >
        {children}
      </SubtitlesUIContext>
    </JotaiProvider>
  )
}
