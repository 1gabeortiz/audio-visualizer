function CustomizerPanel({ settings, onChange, disabled = false }) {
  // Functional update keeps this safe when multiple sliders move quickly.
  function update(key, value) {
    onChange((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <section className="customizer">
      <h2>Visualizer Controls</h2>

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