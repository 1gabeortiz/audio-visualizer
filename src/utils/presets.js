// Built-in palettes shown by default in the palette editor.
// Stops store only semantic data { color, position }; IDs are generated at load time.
export const BUILTIN_PRESETS = [
  {
    id: "neon-dreams",
    name: "Neon Dreams",
    stops: [
      { color: "#7c4dff", position: 0 },
      { color: "#00d4ff", position: 50 },
      { color: "#ff4da6", position: 100 },
    ],
  },
  {
    id: "sunset",
    name: "Sunset",
    stops: [
      { color: "#ff6b00", position: 0 },
      { color: "#ff2d55", position: 55 },
      { color: "#9b1fe8", position: 100 },
    ],
  },
  {
    id: "ocean-depths",
    name: "Ocean Depths",
    stops: [
      { color: "#00e5ff", position: 0 },
      { color: "#0077b6", position: 50 },
      { color: "#03045e", position: 100 },
    ],
  },
  {
    id: "fire",
    name: "Fire",
    stops: [
      { color: "#fff176", position: 0 },
      { color: "#ff6d00", position: 45 },
      { color: "#b71c1c", position: 100 },
    ],
  },
  {
    id: "forest",
    name: "Forest",
    stops: [
      { color: "#69f0ae", position: 0 },
      { color: "#2e7d32", position: 55 },
      { color: "#004d40", position: 100 },
    ],
  },
  {
    id: "mono-glow",
    name: "Mono Glow",
    stops: [
      { color: "#1a1a2e", position: 0 },
      { color: "#7c4dff", position: 60 },
      { color: "#e0e0e0", position: 100 },
    ],
  },
]

const STORAGE_KEY = "audio-viz-presets"

/**
 * Validate and sanitize an array of stop objects from untrusted sources (localStorage, imports).
 * Returns a cleaned `{ color, position }[]` array, or null if the data is unusable.
 * Guarantees: 2–8 stops, valid hex colors, sorted, anchored at 0% and 100%, no collisions.
 */
export function sanitizePresetStops(stops) {
  if (!Array.isArray(stops) || stops.length < 2 || stops.length > 8) return null

  const hexRegex = /^#[0-9a-f]{6}$/i

  const sanitized = stops.map((s, index) => ({
    color: typeof s.color === "string" && hexRegex.test(s.color) ? s.color.toLowerCase() : "#7c4dff",
    position: Number.isFinite(Number(s.position))
      ? Math.round(Math.min(100, Math.max(0, Number(s.position))))
      : Math.round((index / (stops.length - 1)) * 100),
  }))

  sanitized.sort((a, b) => a.position - b.position)
  sanitized[0].position = 0
  sanitized[sanitized.length - 1].position = 100

  // Resolve colliding middle positions by nudging forward; reject if unresolvable.
  for (let i = 1; i < sanitized.length - 1; i++) {
    const minPos = sanitized[i - 1].position + 1
    const maxPos = sanitized[i + 1].position - 1
    if (minPos > maxPos) return null
    sanitized[i].position = Math.max(minPos, Math.min(maxPos, sanitized[i].position))
  }

  return sanitized
}

/** Checks that a saved preset record has the shape we expect. */
function isValidSavedPreset(p) {
  return (
    p != null &&
    typeof p.id === "string" &&
    typeof p.name === "string" &&
    p.name.trim() !== "" &&
    sanitizePresetStops(p.stops) !== null
  )
}

/** Load all user-saved presets from localStorage. Returns [] on any error. */
export function loadSavedPresets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidSavedPreset)
  } catch {
    return []
  }
}

/**
 * Save a preset by name. If a saved preset with the same name already exists it is overwritten.
 * Returns the updated saved-presets array.
 */
export function savePreset(name, stops) {
  try {
    const trimmed = name.trim()
    if (!trimmed) return loadSavedPresets()

    const existing = loadSavedPresets()
    const idx = existing.findIndex((p) => p.name === trimmed)

    const next =
      idx !== -1
        ? existing.map((p, i) => (i === idx ? { ...p, stops } : p))
        : [...existing, { id: `saved-${Date.now()}`, name: trimmed, stops }]

    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    return next
  } catch {
    return loadSavedPresets()
  }
}

/** Delete a saved preset by id. Returns the updated saved-presets array. */
export function deletePreset(id) {
  try {
    const existing = loadSavedPresets()
    const next = existing.filter((p) => p.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    return next
  } catch {
    return loadSavedPresets()
  }
}
