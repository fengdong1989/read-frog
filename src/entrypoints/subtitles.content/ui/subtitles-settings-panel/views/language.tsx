import { i18n } from "#imports"
import { useAtom } from "jotai"
import { use } from "react"
import { LanguageCombobox } from "@/components/language-combobox"
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/base-ui/field"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { ShadowWrapperContext } from "@/utils/react-shadow-host/create-shadow-host"
import { subtitlesStore } from "../../../atoms"
import { useSubtitlesUI } from "../../subtitles-ui-context"

export function LanguageView() {
  const [config, setConfig] = useAtom(configFieldsAtomMap.videoSubtitles, { store: subtitlesStore })
  const { refreshSubtitleTranslation, detectedSourceLangCode } = useSubtitlesUI()
  const portalContainer = use(ShadowWrapperContext)

  const handleLanguageChange = (patch: Partial<typeof config>) => {
    void setConfig(patch)
    refreshSubtitleTranslation()
  }

  return (
    <div className="min-h-[calc(100cqh-6rem)] px-3 pb-4 pt-3">
      <div className="bg-muted/50 divide-border rounded-xl border divide-y p-3">
        <Field>
          <FieldContent>
            <FieldLabel htmlFor="subtitles-panel-source-language">
              {i18n.t("options.videoSubtitles.language.sourceLabel")}
            </FieldLabel>
            <LanguageCombobox
              container={portalContainer}
              className="w-full"
              value={config.sourceCode}
              detectedLangCode={detectedSourceLangCode}
              onValueChange={sourceCode => handleLanguageChange({ sourceCode })}
              placeholder={i18n.t("options.videoSubtitles.language.placeholder")}
            />
            <FieldDescription>
              {i18n.t("options.videoSubtitles.language.sourceDescription")}
            </FieldDescription>
          </FieldContent>
        </Field>

        <Field className="pt-3">
          <FieldContent>
            <FieldLabel htmlFor="subtitles-panel-target-language">
              {i18n.t("options.videoSubtitles.language.targetLabel")}
            </FieldLabel>
            <LanguageCombobox
              container={portalContainer}
              className="w-full"
              value={config.targetCode}
              includeAuto={false}
              onValueChange={(targetCode) => {
                if (targetCode !== "auto") {
                  handleLanguageChange({ targetCode })
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
    </div>
  )
}