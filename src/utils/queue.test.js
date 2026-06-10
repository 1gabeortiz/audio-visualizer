import { describe, expect, it } from "vitest"
import {
  getNextTrackId,
  getPreviousTrackId,
  getTrackIndex,
  moveQueueItem,
} from "./queue"

const sampleQueue = [{ id: "a" }, { id: "b" }, { id: "c" }]

describe("moveQueueItem", () => {
  it("moves an item to a new position", () => {
    const moved = moveQueueItem(sampleQueue, 0, 2)
    expect(moved.map((item) => item.id)).toEqual(["b", "c", "a"])
  })

  it("returns unchanged copy for invalid indexes", () => {
    const moved = moveQueueItem(sampleQueue, -1, 2)
    expect(moved.map((item) => item.id)).toEqual(["a", "b", "c"])
    expect(moved).not.toBe(sampleQueue)
  })
})

describe("track navigation helpers", () => {
  it("returns current track index", () => {
    expect(getTrackIndex(sampleQueue, "b")).toBe(1)
    expect(getTrackIndex(sampleQueue, "x")).toBe(-1)
  })

  it("returns next track id", () => {
    expect(getNextTrackId(sampleQueue, "a")).toBe("b")
    expect(getNextTrackId(sampleQueue, "c")).toBeNull()
    expect(getNextTrackId(sampleQueue, "missing")).toBe("a")
  })

  it("returns previous track id", () => {
    expect(getPreviousTrackId(sampleQueue, "b")).toBe("a")
    expect(getPreviousTrackId(sampleQueue, "a")).toBeNull()
  })
})
