/**
 * Migration script from v078 to v079
 * - Adds videoSubtitles.sourceCode and videoSubtitles.targetCode for independent subtitle languages.
 */
export function migrate(oldConfig: any): any {
  const globalTargetCode = oldConfig?.language?.targetCode ?? "cmn"

  return {
    ...oldConfig,
    videoSubtitles: {
      ...oldConfig?.videoSubtitles,
      sourceCode: oldConfig?.videoSubtitles?.sourceCode ?? "auto",
      targetCode: oldConfig?.videoSubtitles?.targetCode ?? globalTargetCode,
    },
  }
}