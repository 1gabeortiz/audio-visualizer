import { useState, useRef } from "react"
 import {
   BUILTIN_PRESETS,
   loadSavedPresets,
   savePreset,
   deletePreset,
   sanitizePresetStops,
   sanitizeVisualizerPreset,
 } from "../utils/presets"


function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function normalizePaletteStops(paletteColors) {
  const fallback = [
    { id: "stop-1", color: "#7c4dff", position: 0 },
    { id: "stop-2", color: "#00d4ff", position: 50 },
    { id: "stop-3", color: "#ff4da6", position: 100 },
  ]

  if (!Array.isArray(paletteColors) || paletteColors.length < 2) return fallback

  const first = paletteColors[0]
  const stops = typeof first === "string"
    ? paletteColors.map((color, index, arr) => ({
        id: `legacy-stop-${index + 1}`,
        color: color.toLowerCase(),
        position: Math.round((index / (arr.length - 1)) * 100),
      }))
    : paletteColors.map((stop, index) => ({
        id: stop.id || `stop-${index + 1}`,
        color: (stop.color || "#7c4dff").toLowerCase(),
        position: Number.isFinite(stop.position) ? stop.position : index * 50,
      }))

  stops.sort((a, b) => a.position - b.position)
  stops[0].position = 0
  stops[stops.length - 1].position = 100
  return stops
}

function CustomizerPanel({ settings, onChange, disabled = false }) {
  const defaultSingleColor = "#7c4dff"
  const singleColorValue = settings.singleColor || defaultSingleColor

  // Preset management state (local — doesn't need to live in App)
  const [savedPresets, setSavedPresets] = useState(loadSavedPresets)
  const [selectedPresetKey, setSelectedPresetKey] = useState("")
  const [presetNameInput, setPresetNameInput] = useState("")
  const importInputRef = useRef(null)

  function update(key, value) {
    onChange((prev) => ({ ...prev, [key]: value }))
  }

  function setPaletteStops(nextStops) {
    update("paletteColors", normalizePaletteStops(nextStops))
  }

  const paletteStops = normalizePaletteStops(settings.paletteColors)

  // CSS gradient string derived from normalized stops — used for the preview bar.
  const gradientStyle = {
    background: `linear-gradient(to right, ${paletteStops
      .map((s) => `${s.color} ${s.position}%`)
      .join(", ")})`,
  }

  function updatePaletteColor(id, nextColor) {
    const nextStops = paletteStops.map((stop) =>
      stop.id === id ? { ...stop, color: nextColor.toLowerCase() } : stop
    )
    setPaletteStops(nextStops)
  }

  function updatePalettePosition(id, nextPosition) {
    const index = paletteStops.findIndex((stop) => stop.id === id)
    if (index <= 0 || index >= paletteStops.length - 1) return // Keep anchors fixed

    const min = paletteStops[index - 1].position + 1
    const max = paletteStops[index + 1].position - 1
    const clamped = clamp(Number(nextPosition), min, max)

    const nextStops = paletteStops.map((stop) =>
      stop.id === id ? { ...stop, position: clamped } : stop
    )
    setPaletteStops(nextStops)
  }

   function getNextStopId(stops) {
    const maxId = stops.reduce((max, stop) => {
      const match = String(stop.id || "").match(/(\d+)$/)
      return match ? Math.max(max, Number(match[1])) : max
    }, 0)
  
    return `stop-${maxId + 1}`
  }

  function addPaletteStop() {
    if (paletteStops.length >= 8) return

    // Insert before the final anchor (100%)
    const insertAt = paletteStops.length - 1
    const left = paletteStops[insertAt - 1]
    const right = paletteStops[insertAt]
    const midPosition = Math.round((left.position + right.position) / 2)

    const newStop = {
      id: getNextStopId(paletteStops),
      color: left.color,
      position: midPosition,
    }

    const nextStops = [
      ...paletteStops.slice(0, insertAt),
      newStop,
      ...paletteStops.slice(insertAt),
    ]
    setPaletteStops(nextStops)
  }

  function removePaletteStop(id) {
    const index = paletteStops.findIndex((stop) => stop.id === id)
    if (index <= 0 || index >= paletteStops.length - 1) return // Keep anchors fixed
    if (paletteStops.length <= 2) return

    const nextStops = paletteStops.filter((stop) => stop.id !== id)
    setPaletteStops(nextStops)
  }

  // ── Preset handlers ─────────────────────────────────────────────────────────

  function handleLoadPreset() {
    if (!selectedPresetKey) return

    let raw = null
    if (selectedPresetKey.startsWith("builtin:")) {
      const id = selectedPresetKey.slice("builtin:".length)
      raw = BUILTIN_PRESETS.find((p) => p.id === id)?.stops ?? null
    } else if (selectedPresetKey.startsWith("saved:")) {
      const id = selectedPresetKey.slice("saved:".length)
      raw = savedPresets.find((p) => p.id === id)?.stops ?? null
    }

    if (!raw) return
    const sanitized = sanitizePresetStops(raw)
    if (!sanitized) return

    // Re-attach stable IDs before passing to the stop editor
    const stops = sanitized.map((s, i) => ({ id: `stop-${i + 1}`, ...s }))
    setPaletteStops(stops)
  }

  function handleSavePreset() {
    const name = presetNameInput.trim()
    if (!name) return
    // Persist only semantic data; IDs are UI-internal and not needed in storage
    const stopsToSave = paletteStops.map(({ color, position }) => ({ color, position }))
    const next = savePreset(name, stopsToSave)
    setSavedPresets(next)
    setPresetNameInput("")
    // Auto-select the newly saved preset so the user can immediately delete it if wanted
    const saved = next.find((p) => p.name === name)
    if (saved) setSelectedPresetKey(`saved:${saved.id}`)
  }

  function handleDeletePreset() {
    if (!selectedPresetKey.startsWith("saved:")) return
    const id = selectedPresetKey.slice("saved:".length)
    const next = deletePreset(id)
    setSavedPresets(next)
    setSelectedPresetKey("")
  }

  // ── Export / Import ──────────────────────────────────────────────────────────

  function handleExportPalette() {
    const data = paletteStops.map(({ color, position }) => ({ color, position }))
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "palette.json"
    anchor.click()
    URL.revokeObjectURL(url)
  }

  function handleImportPalette(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target.result)
        const sanitized = sanitizePresetStops(parsed)
        if (!sanitized) return
        const stops = sanitized.map((s, i) => ({ id: `stop-${i + 1}`, ...s }))
        setPaletteStops(stops)
      } catch {
        // Invalid JSON — silently ignore
      }
    }
    reader.readAsText(file)
    e.target.value = "" // Reset so the same file can be re-imported
  }

  function handleExportVisualizerPreset() {
  const data = {
    colorMode: settings.colorMode,
    singleColor: settings.singleColor,
    paletteColors: normalizePaletteStops(settings.paletteColors).map(({ color, position }) => ({
      color,
      position,
    })),
    hueShift: settings.hueShift,
    autoCycle: settings.autoCycle,
    cycleSpeed: settings.cycleSpeed,
    barCount: settings.barCount,
    glow: settings.glow,
    intensity: settings.intensity,
  }

  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = "visualizer-preset.json"
  anchor.click()
  URL.revokeObjectURL(url)
}

function handleImportVisualizerPreset(e) {
  const file = e.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (evt) => {
    try {
      const parsed = JSON.parse(evt.target.result)
      const sanitized = sanitizeVisualizerPreset(parsed)
      if (!sanitized) return

      onChange((prev) => ({
        ...prev,
        ...sanitized,
        // Rebuild UI IDs for stop editor
        paletteColors: sanitized.paletteColors.map((s, i) => ({
          id: `stop-${i + 1}`,
          ...s,
        })),
      }))
    } catch {
      // Invalid JSON - ignore
    }
  }

  reader.readAsText(file)
  e.target.value = ""
}

  return (
    <section className="customizer">
      <h2>Visualizer Controls</h2>

      <label>
        Color Mode
        <select
          value={settings.colorMode}
          onChange={(e) => update("colorMode", e.target.value)}
          disabled={disabled}
        >
          <option value="rainbow">Rainbow</option>
          <option value="single">Single Color</option>
          <option value="palette">Palette</option>
        </select>
      </label>

      {settings.colorMode === "single" && (
        <label>
          Single Color
          <input
            type="color"
            value={singleColorValue}
            onInput={(e) => update("singleColor", e.target.value.toLowerCase())}
            onChange={(e) => update("singleColor", e.target.value.toLowerCase())}
            disabled={disabled}
          />
          <small>{singleColorValue.toUpperCase()}</small>
        </label>
      )}

      {settings.colorMode === "palette" && (
        <div className="palette-editor">
          <label>Palette Stops</label>

          {/* Presets: load built-ins or saved palettes, save current, delete saved */}
          <div className="presets-section">
            <span className="presets-label">Presets</span>

            <div className="presets-controls">
              <select
                value={selectedPresetKey}
                onChange={(e) => setSelectedPresetKey(e.target.value)}
                disabled={disabled}
              >
                <option value="">— Choose a preset —</option>
                <optgroup label="Built-in">
                  {BUILTIN_PRESETS.map((p) => (
                    <option key={p.id} value={`builtin:${p.id}`}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
                {savedPresets.length > 0 && (
                  <optgroup label="Saved">
                    {savedPresets.map((p) => (
                      <option key={p.id} value={`saved:${p.id}`}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>

              <button
                type="button"
                onClick={handleLoadPreset}
                disabled={disabled || !selectedPresetKey}
              >
                Load
              </button>

              {selectedPresetKey.startsWith("saved:") && (
                <button
                  type="button"
                  onClick={handleDeletePreset}
                  disabled={disabled}
                  className="preset-btn--danger"
                >
                  Delete
                </button>
              )}
            </div>

            <div className="presets-save">
              <input
                type="text"
                placeholder="Name this palette…"
                value={presetNameInput}
                onChange={(e) => setPresetNameInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSavePreset()}
                disabled={disabled}
                maxLength={40}
              />
              <button
                type="button"
                onClick={handleSavePreset}
                disabled={disabled || !presetNameInput.trim()}
              >
                Save
              </button>
            </div>
          </div>

          {/* Live gradient preview derived from current stops */}
          <div className="palette-preview" style={gradientStyle} aria-hidden="true" />

          {paletteStops.map((stop, index) => {
            const isAnchor = index === 0 || index === paletteStops.length - 1
            const min = isAnchor ? stop.position : paletteStops[index - 1].position + 1
            const max = isAnchor ? stop.position : paletteStops[index + 1].position - 1

            return (
               <div
                  key={stop.id}
                  className="palette-row"
                  style={{ "--stop-color": stop.color }} // Row accent color matches this stop
                >
                  <label className="palette-color-control">
                    <span className="palette-stop-label">
                      Stop {index + 1}
                      {isAnchor ? " (anchor)" : ""}
                    </span>
                
                    {/* Larger color input improves clickability and makes stop identity obvious */}
                    <input
                      className="palette-color-input"
                      type="color"
                      value={stop.color}
                      onInput={(e) => updatePaletteColor(stop.id, e.target.value)}
                      onChange={(e) => updatePaletteColor(stop.id, e.target.value)}
                      disabled={disabled}
                    />
                
                    <small className="palette-color-hex">{stop.color.toUpperCase()}</small>
                  </label>
                
                  <label className="palette-position">
                    <span>Position: {stop.position}%</span>
                    <input
                      type="range"
                      min={min}
                      max={max}
                      step="1"
                      value={stop.position}
                      onChange={(e) => updatePalettePosition(stop.id, e.target.value)}
                      disabled={disabled || isAnchor}
                    />
                  </label>
                
                  <button
                    type="button"
                    onClick={() => removePaletteStop(stop.id)}
                    disabled={disabled || isAnchor || paletteStops.length <= 2}
                  >
                    Remove
                  </button>
                </div>
            )
          })}

          <button
            type="button"
            onClick={addPaletteStop}
            disabled={disabled || paletteStops.length >= 8}
          >
            + Add Color Stop
          </button>

          {/* Export downloads palette.json; Import reads a previously exported file */}
          <div className="preset-io">
            <button type="button" onClick={handleExportPalette} disabled={disabled}>
              Export Palette Preset
            </button>

            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              disabled={disabled}
            >
              Import Palette Preset
            </button>

            <input
              ref={importInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImportPalette}
              style={{ display: "none" }}
            />

            <button type="button" onClick={handleExportVisualizerPreset} disabled={disabled}>
              Export Full Preset
            </button>
            
            <button
              type="button"
              onClick={() => document.getElementById("import-full-preset-input")?.click()}
              disabled={disabled}
            >
              Import Full Preset
            </button>
            
            <input
              id="import-full-preset-input"
              type="file"
              accept=".json,application/json"
              onChange={handleImportVisualizerPreset}
              style={{ display: "none" }}
            />
          </div>

          <small>First/last stops are locked at 0% and 100%. Max 8 stops.</small>
        </div>
      )}

      <label>
        Intensity: {settings.intensity.toFixed(2)}
        <input
          type="range"
          min="0.4"
          max="2"
          step="0.01"
          value={settings.intensity}
          onChange={(e) => update("intensity", Number(e.target.value))}
          disabled={disabled}
        />
      </label>

      {settings.colorMode === "rainbow" && (
        <>
          <label>
            Hue Shift: {settings.hueShift}
            <input
              type="range"
              min="0"
              max="360"
              step="1"
              value={settings.hueShift}
              onChange={(e) => update("hueShift", Number(e.target.value))}
              disabled={disabled}
            />
          </label>

          <label className="customizer-toggle">
            <span>Auto-cycle hues</span>
            <input
              type="checkbox"
              checked={settings.autoCycle}
              onChange={(e) => update("autoCycle", e.target.checked)}
              disabled={disabled}
            />
          </label>

          {settings.autoCycle && (
            <label>
              Cycle Speed: {settings.cycleSpeed}°/s
              <input
                type="range"
                min="5"
                max="240"
                step="1"
                value={settings.cycleSpeed}
                onChange={(e) => update("cycleSpeed", Number(e.target.value))}
                disabled={disabled}
              />
            </label>
          )}
        </>
      )}

      <label>
        Glow: {settings.glow}
        <input
          type="range"
          min="0"
          max="30"
          step="1"
          value={settings.glow}
          onChange={(e) => update("glow", Number(e.target.value))}
          disabled={disabled}
        />
      </label>

      <label>
        Bar Density: {settings.barCount}
        <input
          type="range"
          min="32"
          max="160"
          step="1"
          value={settings.barCount}
          onChange={(e) => update("barCount", Number(e.target.value))}
          disabled={disabled}
        />
      </label>
    </section>
  )
}

export default CustomizerPanel
