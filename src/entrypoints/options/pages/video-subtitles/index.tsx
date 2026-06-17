import { i18n } from "#imports"
import { PageLayout } from "../../components/page-layout"
import { ClearAiSegmentationCache } from "./clear-ai-segmentation-cache"
import { SubtitlesConfig } from "./subtitles-config"
import { SubtitlesLanguage } from "./subtitles-language"
import { SubtitlesCustomPrompts } from "./subtitles-custom-prompts"
import { SubtitlesRequestBatch } from "./subtitles-request-batch"
import { SubtitlesRequestRate } from "./subtitles-request-rate"
import { SubtitlesStyleSettings } from "./subtitles-style-settings"

export function VideoSubtitlesPage() {
  return (
    <PageLayout title={i18n.t("options.videoSubtitles.title")}>
      <div className="*:border-b [&>*:last-child]:border-b-0">
        <SubtitlesConfig />
        <SubtitlesLanguage />
        <SubtitlesStyleSettings />
        <SubtitlesCustomPrompts />
        <SubtitlesRequestRate />
        <SubtitlesRequestBatch />
        <ClearAiSegmentationCache />
      </div>
    </PageLayout>
  )
}
