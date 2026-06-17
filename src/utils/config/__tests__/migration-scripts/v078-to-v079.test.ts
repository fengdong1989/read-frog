import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v078-to-v079"

describe("migration v078-to-v079", () => {
  it("adds videoSubtitles source and target language defaults", () => {
    const result = migrate({
      language: {
        sourceCode: "eng",
        targetCode: "jpn",
        level: "intermediate",
      },
      videoSubtitles: {
        enabled: true,
      },
    })

    expect(result.videoSubtitles.sourceCode).toBe("auto")
    expect(result.videoSubtitles.targetCode).toBe("jpn")
  })

  it("preserves existing subtitle language settings", () => {
    const result = migrate({
      videoSubtitles: {
        sourceCode: "eng",
        targetCode: "cmn",
      },
    })

    expect(result.videoSubtitles.sourceCode).toBe("eng")
    expect(result.videoSubtitles.targetCode).toBe("cmn")
  })
})