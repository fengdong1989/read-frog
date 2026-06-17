// @vitest-environment jsdom
import type { LangCodeISO6393 } from "@read-frog/definitions"
import { render, screen } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"

import { MainSubtitle, TranslationSubtitle } from "../subtitle-lines"

const mockedAtoms = vi.hoisted(() => ({
  videoSubtitlesAtom: null as any,
}))

vi.mock("@/utils/atoms/config", async () => {
  const { atom } = await import("jotai")
  const videoSubtitlesAtom = atom(DEFAULT_CONFIG.videoSubtitles)

  mockedAtoms.videoSubtitlesAtom = videoSubtitlesAtom

  return {
    configFieldsAtomMap: {
      videoSubtitles: videoSubtitlesAtom,
    },
  }
})

function createStoreWithLanguage(targetCode: LangCodeISO6393) {
  const store = createStore()
  store.set(mockedAtoms.videoSubtitlesAtom, {
    ...DEFAULT_CONFIG.videoSubtitles,
    targetCode,
  })
  return store
}

describe("subtitle lines", () => {
  it("applies rtl attributes to translation subtitle for Arabic target language", () => {
    const store = createStoreWithLanguage("arb")

    render(
      <Provider store={store}>
        <TranslationSubtitle content="مرحبًا" />
      </Provider>,
    )

    const line = screen.getByText("مرحبًا")
    expect(line).toHaveAttribute("dir", "rtl")
    expect(line).toHaveAttribute("lang", "ar")
  })

  it("applies ltr attributes to translation subtitle for English target language", () => {
    const store = createStoreWithLanguage("eng")

    render(
      <Provider store={store}>
        <TranslationSubtitle content="Hello world" />
      </Provider>,
    )

    const line = screen.getByText("Hello world")
    expect(line).toHaveAttribute("dir", "ltr")
    expect(line).toHaveAttribute("lang", "en")
  })

  it("keeps main subtitle line without forced dir/lang attributes", () => {
    const store = createStoreWithLanguage("eng")

    render(
      <Provider store={store}>
        <MainSubtitle content="Hello world" />
      </Provider>,
    )

    const line = screen.getByText("Hello world")
    expect(line).not.toHaveAttribute("dir")
    expect(line).not.toHaveAttribute("lang")
  })
})
