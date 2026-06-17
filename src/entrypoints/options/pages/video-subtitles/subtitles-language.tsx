import { i18n } from "#imports"
import { useAtom } from "jotai"
import { LanguageCombobox } from "@/components/language-combobox"
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/base-ui/field"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { ConfigCard } from "../../components/config-card"

export function SubtitlesLanguage() {
  const [videoSubtitlesConfig, setVideoSubtitlesConfig] = useAtom(configFieldsAtomMap.videoSubtitles)

  return (
    <ConfigCard
      id="subtitles-language"
      title={i18n.t("options.videoSubtitles.language.title")}
      description={i18n.t("options.videoSubtitles.language.description")}
    >
      <div className="space-y-6">
        <Field>
          <FieldContent>
            <FieldLabel htmlFor="video-subtitles-source-language">
              {i18n.t("options.videoSubtitles.language.sourceLabel")}
            </FieldLabel>
            <LanguageCombobox
              className="w-full"
              value={videoSubtitlesConfig.sourceCode}
              onValueChange={sourceCode => void setVideoSubtitlesConfig({ sourceCode })}
              placeholder={i18n.t("options.videoSubtitles.language.placeholder")}
            />
            <FieldDescription>
              {i18n.t("options.videoSubtitles.language.sourceDescription")}
            </FieldDescription>
          </FieldContent>
        </Field>

        <Field>
          <FieldContent>
            <FieldLabel htmlFor="video-subtitles-target-language">
              {i18n.t("options.videoSubtitles.language.targetLabel")}
            </FieldLabel>
            <LanguageCombobox
              className="w-full"
              value={videoSubtitlesConfig.targetCode}
              includeAuto={false}
              onValueChange={(targetCode) => {
                if (targetCode !== "auto") {
                  void setVideoSubtitlesConfig({ targetCode })
                }
              }}
              placeholder={i18n.t("options.videoSubtitles.language.targetPlaceholder")}
            />
            <FieldDescription>
              {i18n.t("options.videoSubtitles.language.targetDescription")}
            </FieldDescription>
          </FieldContent>
        </Field>
      </div>
    </ConfigCard>
  )
}