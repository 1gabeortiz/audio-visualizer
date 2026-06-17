import { useEffect, useRef } from "react"

const DEFAULT_BAR_COUNT = 96
const MAX_BAR_COUNT = 160
const MIN_BAR_COUNT = 32
const SMOOTHING = 0.18 // Lower is smoother, higher is more reactive.

function hexToRgb(hexColor) {
  const hex = (hexColor || "#7c4dff").replace("#", "").trim()
  if (hex.length === 3) {
    return {
      r: Number.parseInt(hex[0] + hex[0], 16),
      g: Number.parseInt(hex[1] + hex[1], 16),
      b: Number.parseInt(hex[2] + hex[2], 16),
    }
  }

  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  }
}

 function lerp(start, end, t) {
   return start + (end - start) * t
 }
 
  function getPaletteColor(progress, paletteColors, alpha) {
   const fallback = [
     { id: "fallback-1", color: "#7c4dff", position: 0 },
     { id: "fallback-2", color: "#00d4ff", position: 50 },
     { id: "fallback-3", color: "#ff4da6", position: 100 },
   ]
 
   let stops = Array.isArray(paletteColors) ? paletteColors : fallback
   if (stops.length < 2) stops = fallback
 
   // Backward compatibility: if old string-array format exists, convert it.
   if (typeof stops[0] === "string") {
     stops = stops.map((color, index, arr) => ({
       id: `legacy-${index}`,
       color,
       position: Math.round((index / (arr.length - 1)) * 100),
     }))
   }
 
   const sorted = [...stops].sort((a, b) => a.position - b.position)
   const progressPct = progress * 100
 
   // Clamp to edges
   if (progressPct <= sorted[0].position) {
     const { r, g, b } = hexToRgb(sorted[0].color)
     return `rgba(${r}, ${g}, ${b}, ${alpha})`
   }
   if (progressPct >= sorted[sorted.length - 1].position) {
     const { r, g, b } = hexToRgb(sorted[sorted.length - 1].color)
     return `rgba(${r}, ${g}, ${b}, ${alpha})`
   }
 
   // Find segment that contains progressPct
   let left = sorted[0]
   let right = sorted[sorted.length - 1]
   for (let i = 1; i < sorted.length; i++) {
     if (progressPct <= sorted[i].position) {
       left = sorted[i - 1]
       right = sorted[i]
       break
     }
   }
 
   const span = Math.max(1, right.position - left.position)
   const t = (progressPct - left.position) / span
 
   const start = hexToRgb(left.color)
   const end = hexToRgb(right.color)
 
   const r = Math.round(lerp(start.r, end.r, t))
   const g = Math.round(lerp(start.g, end.g, t))
   const b = Math.round(lerp(start.b, end.b, t))
   return `rgba(${r}, ${g}, ${b}, ${alpha})`
 }

 function getVisualizerColor({
   colorMode,
   progress,
   hueSpan,
   animatedHueShift,
   singleColorRgb,
   paletteColors,
   alpha,
 }) {
   if (colorMode === "single") {
     const { r, g, b } = singleColorRgb
     return `rgba(${r}, ${g}, ${b}, ${alpha})`
   }
 
   if (colorMode === "palette") {
     return getPaletteColor(progress, paletteColors, alpha)
   }
 
   const hue = (progress * hueSpan + 20 + animatedHueShift) % 360
   return `hsla(${hue}, 92%, 62%, ${alpha})`
 }

function Visualizer({ analyzerData, mode = "bars", settings }) {
  const canvasRef = useRef(null)
  const animationIdRef = useRef(null)
  const smoothedDataRef = useRef(new Float32Array(MAX_BAR_COUNT))

  const intensity = settings?.intensity ?? 1
  const hueShift = settings?.hueShift ?? 0
  const glow = settings?.glow ?? 14
  const dynamicBarCount = settings?.barCount ?? DEFAULT_BAR_COUNT
  const colorMode = settings?.colorMode ?? "rainbow"
  const singleColor = settings?.singleColor ?? "#7c4dff"
  const autoCycle = settings?.autoCycle ?? false
  const cycleSpeed = settings?.cycleSpeed ?? 45
  const paletteColors = settings?.paletteColors

  const cycleHueOffsetRef = useRef(0)
  const previousFrameTimeRef = useRef(null)

  useEffect(() => {
    if (!analyzerData) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    const { analyser, dataArray, bufferLength } = analyzerData
    const singleColorRgb = hexToRgb(singleColor)

    function resizeCanvas() {
        const dpr = window.devicePixelRatio || 1
        const width = canvas.clientWidth
        const height = canvas.clientHeight
        const nextWidth = Math.round(width * dpr)
        const nextHeight = Math.round(height * dpr)
        if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
          canvas.width = nextWidth
          canvas.height = nextHeight
        }
        // Reset then apply DPR transform to avoid compounding transforms.
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.scale(dpr, dpr)
      }

    function draw(frameTime) {
      // Track frame-to-frame time so hue animation speed is consistent.
      const previousFrameTime = previousFrameTimeRef.current
      previousFrameTimeRef.current = frameTime
      const deltaSeconds = previousFrameTime ? Math.min((frameTime - previousFrameTime) / 1000, 0.05) : 0

      if (autoCycle) {
        cycleHueOffsetRef.current = (cycleHueOffsetRef.current + cycleSpeed * deltaSeconds) % 360
      }
      const animatedHueShift = (hueShift + cycleHueOffsetRef.current) % 360
    
      resizeCanvas()
      analyser.getByteFrequencyData(dataArray)

      const width = canvas.clientWidth
      const height = canvas.clientHeight
      const safeBarCount = Math.max(MIN_BAR_COUNT, Math.min(MAX_BAR_COUNT, dynamicBarCount))
      const step = Math.floor(bufferLength / safeBarCount) || 1
      const barWidth = width / safeBarCount
      const rainbowHueSpan = 320

      // Draw a translucent frame each tick for a trailing animation effect.
      ctx.fillStyle = "rgba(10, 10, 10, 0.22)"
      ctx.fillRect(0, 0, width, height)

      if (mode === "bars") {
        for (let i = 0; i < safeBarCount; i++) {
          const sourceIndex = i * step
          const raw = (dataArray[sourceIndex] || 0) / 255
          const prev = smoothedDataRef.current[i]
          const smooth = prev + (raw - prev) * SMOOTHING
          smoothedDataRef.current[i] = smooth

          const barHeight = smooth * height * 0.9 * intensity
          const x = i * barWidth
          const progress = i / safeBarCount
          const mainColor = getVisualizerColor({
            colorMode,
            progress,
            hueSpan: rainbowHueSpan,
            animatedHueShift,
            singleColorRgb,
            alpha: 0.95,
            paletteColors,
          })
          const glowColor = getVisualizerColor({
            colorMode,
            progress,
            hueSpan: rainbowHueSpan,
            animatedHueShift,
            singleColorRgb,
            alpha: 0.65,
            paletteColors,
          })

          ctx.fillStyle = mainColor
          ctx.shadowBlur = glow
          ctx.shadowColor = glowColor
          ctx.fillRect(x, height - barHeight, Math.max(barWidth - 2, 1), barHeight)
        }
      } else {
        const cx = width / 2
        // Zoom-aware vertical anchor: compensate when browser zoom > 100%.
        const zoomScale = window.visualViewport?.scale || 1
        const zoomShiftUp = Math.max(0, zoomScale - 1) * (height * 0.2)
        // Start from geometric center, then shift upward as zoom increases.
        const cy = height / 2 - zoomShiftUp
        const inset = glow * 2 + 22
        const maxRadiusX = Math.max(36, width / 2 - inset)
        const maxRadiusTop = Math.max(36, cy - inset)
        const maxRadiusBottom = Math.max(36, height - cy - inset)
        const maxReach = Math.min(maxRadiusX, maxRadiusTop, maxRadiusBottom)
        const baseRadius = maxReach * 0.36
        const maxLineLength = Math.max(14, maxReach - baseRadius)

        const halfBars = Math.max(2, Math.floor(safeBarCount / 2))
        const densityProgress = (safeBarCount - MIN_BAR_COUNT) / (MAX_BAR_COUNT - MIN_BAR_COUNT)
        // Expand hue span toward 360 as density increases to hide radial seam.
        const radialHueSpan = 320 + densityProgress * 40

        ctx.save()
        ctx.translate(cx, cy)

        for (let i = 0; i < halfBars; i++) {
          const sourceIndex = Math.floor(i * step)
          // Tame bass-heavy bins so radial mode stays visually balanced.
          const bassTame = 0.65 + (i / halfBars) * 0.45
          const raw = ((dataArray[sourceIndex] || 0) / 255) * bassTame * intensity
          const prev = smoothedDataRef.current[i]
          const smooth = prev + (raw - prev) * SMOOTHING
          smoothedDataRef.current[i] = smooth

          const angle = (i / halfBars) * Math.PI
          const normalized = Math.min(Math.max(smooth, 0), 1)
          const length = 6 + normalized * (maxLineLength - 6)
          const progress = i / halfBars
          const mainColor = getVisualizerColor({
            colorMode,
            progress,
            hueSpan: radialHueSpan,
            animatedHueShift,
            singleColorRgb,
            alpha: 0.95,
            paletteColors,
          })
          const glowColor = getVisualizerColor({
            colorMode,
            progress,
            hueSpan: radialHueSpan,
            animatedHueShift,
            singleColorRgb,
            paletteColors,
            alpha: 0.65,
          })

          const x1 = Math.cos(angle) * baseRadius
          const y1 = Math.sin(angle) * baseRadius
          const x2 = Math.cos(angle) * (baseRadius + length)
          const y2 = Math.sin(angle) * (baseRadius + length)

          ctx.strokeStyle = mainColor
          ctx.lineWidth = 2
          ctx.shadowBlur = glow
          ctx.shadowColor = glowColor
          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
          ctx.stroke()

          // Mirror each segment to keep the radial shape symmetrical.
          const mirrorAngle = angle + Math.PI
          const mx1 = Math.cos(mirrorAngle) * baseRadius
          const my1 = Math.sin(mirrorAngle) * baseRadius
          const mx2 = Math.cos(mirrorAngle) * (baseRadius + length)
          const my2 = Math.sin(mirrorAngle) * (baseRadius + length)
          ctx.beginPath()
          ctx.moveTo(mx1, my1)
          ctx.lineTo(mx2, my2)
          ctx.stroke()
        }

        ctx.restore()
      }

      ctx.shadowBlur = 0
      animationIdRef.current = requestAnimationFrame(draw)
    }

    resizeCanvas()
    window.addEventListener("resize", resizeCanvas)
    previousFrameTimeRef.current = null
    animationIdRef.current = requestAnimationFrame(draw)

    return () => {
      window.removeEventListener("resize", resizeCanvas)
      if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current)
    }
  }, [analyzerData, colorMode, dynamicBarCount, glow, hueShift, intensity, mode, singleColor, autoCycle, cycleSpeed, paletteColors])

  return (
    <section className="visualizer-wrapper">
      <canvas ref={canvasRef} className="visualizer-canvas" />
    </section>
  )
}

export default Visualizer
