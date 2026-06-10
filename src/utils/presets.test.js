import { describe, expect, it } from "vitest"
import { sanitizePresetStops, sanitizeVisualizerPreset } from "./presets"

describe("sanitizePresetStops", () => {
  it("normalizes and anchors stop positions", () => {
    const result = sanitizePresetStops([
      { color: "#FF0000", position: 22 },
      { color: "#00ff00", position: 61 },
      { color: "#0000ff", position: 80 },
    ])

    expect(result).toEqual([
      { color: "#ff0000", position: 0 },
      { color: "#00ff00", position: 61 },
      { color: "#0000ff", position: 100 },
    ])
  })

  it("returns null for invalid stop counts", () => {
    expect(sanitizePresetStops([{ color: "#ffffff", position: 0 }])).toBeNull()
  })
})

describe("sanitizeVisualizerPreset", () => {
  it("returns normalized visualizer settings", () => {
    const result = sanitizeVisualizerPreset({
      colorMode: "palette",
      singleColor: "#ABCDEF",
      paletteColors: [
        { color: "#111111", position: 5 },
        { color: "#222222", position: 50 },
        { color: "#333333", position: 95 },
      ],
      hueShift: 400,
      autoCycle: true,
      cycleSpeed: 999,
      barCount: 999,
      glow: -10,
      intensity: 4,
    })

    expect(result).toEqual({
      colorMode: "palette",
      singleColor: "#abcdef",
      paletteColors: [
        { color: "#111111", position: 0 },
        { color: "#222222", position: 50 },
        { color: "#333333", position: 100 },
      ],
      hueShift: 360,
      autoCycle: true,
      cycleSpeed: 240,
      barCount: 160,
      glow: 0,
      intensity: 2,
    })
  })
})
