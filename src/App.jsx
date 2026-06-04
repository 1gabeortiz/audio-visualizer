import { useEffect, useRef, useState } from "react"
import FileUpload from "./components/FileUpload"
import SongInfo from "./components/SongInfo"
import { readMetadata } from "./utils/readMetadata"
import AudioPlayer from "./components/AudioPlayer"
import Visualizer from "./components/Visualizer"
import useAudioAnalyzer from "./hooks/useAudioAnalyzer"
import CustomizerPanel from "./components/CustomizerPanel"
import { sanitizeVisualizerPreset } from "./utils/presets"

const VISUALIZER_SETTINGS_STORAGE_KEY = "audio-viz-current-settings"
const VISUALIZER_MODE_STORAGE_KEY = "audio-viz-mode"

function loadInitialVisualizerMode() {
  try {
    const savedMode = localStorage.getItem(VISUALIZER_MODE_STORAGE_KEY)
    return savedMode === "bars" || savedMode === "radial" ? savedMode : "bars"
  } catch {
    return "bars"
  }
}


function getDefaultVisualizerSettings() {
  return {
    intensity: 1,
    hueShift: 0,
    glow: 14,
    barCount: 96,
    colorMode: "rainbow",
    singleColor: "#7c4dff",
    paletteColors: [
      { id: "stop-1", color: "#7c4dff", position: 0 },
      { id: "stop-2", color: "#00d4ff", position: 50 },
      { id: "stop-3", color: "#ff4da6", position: 100 },
    ],
    autoCycle: false,
    cycleSpeed: 45,
  }
}

function loadInitialVisualizerSettings() {
  const fallback = getDefaultVisualizerSettings()
  try {
    const raw = localStorage.getItem(VISUALIZER_SETTINGS_STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    const sanitized = sanitizeVisualizerPreset(parsed)
    if (!sanitized) return fallback
    return { ...fallback, ...sanitized }
  } catch {
    return fallback
  }
}

const LAST_SONG_NAME_STORAGE_KEY = "audio-viz-last-song-name"
function loadLastSongName() {
  try {
    return localStorage.getItem(LAST_SONG_NAME_STORAGE_KEY) || ""
  } catch {
    return ""
  }
}


function App() {
  const [audioUrl, setAudioUrl] = useState(null)
  const [fileName, setFileName] = useState("")
  const [lastSongName, setLastSongName] = useState(loadLastSongName)
  const [metadata, setMetadata] = useState(null)

  // Keep refs to generated object URLs so we can revoke them and avoid memory leaks.
  const audioRef = useRef(null)
  const currentAudioUrlRef = useRef(null)
  const currentCoverUrlRef = useRef(null)

  // Prevent older async metadata reads from overwriting a newer song selection.
  const metadataRequestIdRef = useRef(0)

  const analyzerData = useAudioAnalyzer(audioRef, audioUrl)
  const [vizMode, setVizMode] = useState(loadInitialVisualizerMode)
  // Controls consumed by the visualizer + customizer panel.
  const [visualizerSettings, setVisualizerSettings] = useState(loadInitialVisualizerSettings)

  const hasAudio = Boolean(audioUrl)

  function handleResetSavedUi() {
    const confirmed = window.confirm(
      "Reset saved visualizer settings, mode, and last uploaded song name?"
    )
    if (!confirmed) return
    try {
      localStorage.removeItem(VISUALIZER_SETTINGS_STORAGE_KEY)
      localStorage.removeItem(VISUALIZER_MODE_STORAGE_KEY)
      localStorage.removeItem(LAST_SONG_NAME_STORAGE_KEY)
    } catch {
      // Ignore storage errors
    }
    setVisualizerSettings(getDefaultVisualizerSettings())
    setVizMode("bars")
    setLastSongName("")
  }


  async function handleFileSelect(file) {
    if (currentAudioUrlRef.current) URL.revokeObjectURL(currentAudioUrlRef.current)
    if (currentCoverUrlRef.current) URL.revokeObjectURL(currentCoverUrlRef.current)

    const nextAudioUrl = URL.createObjectURL(file)
    const nextRequestId = metadataRequestIdRef.current + 1
    metadataRequestIdRef.current = nextRequestId

    currentAudioUrlRef.current = nextAudioUrl
    setAudioUrl(nextAudioUrl)

    const nextName = file.name.replace(/\.[^/.]+$/, "")
    setFileName(nextName)
    setLastSongName(nextName)
    setMetadata(null)

    const nextMetadata = await readMetadata(file)
    if (metadataRequestIdRef.current !== nextRequestId) {
      if (nextMetadata.coverUrl) URL.revokeObjectURL(nextMetadata.coverUrl)
      return
    }

    currentCoverUrlRef.current = nextMetadata.coverUrl
    setMetadata(nextMetadata)
  }

  useEffect(() => {
    if (audioUrl && audioRef.current) {
      audioRef.current.load()
      audioRef.current.play()
    }
  }, [audioUrl])

  useEffect(() => {
    return () => {
      if (currentAudioUrlRef.current) URL.revokeObjectURL(currentAudioUrlRef.current)
      if (currentCoverUrlRef.current) URL.revokeObjectURL(currentCoverUrlRef.current)
    }
  }, [])

  useEffect(() => {
  try {
    localStorage.setItem(VISUALIZER_MODE_STORAGE_KEY, vizMode)
  } catch {
    // Ignore storage write errors.
  }
}, [vizMode])


  useEffect(() => {
    try {
      localStorage.setItem(
        VISUALIZER_SETTINGS_STORAGE_KEY,
        JSON.stringify({
          colorMode: visualizerSettings.colorMode,
          singleColor: visualizerSettings.singleColor,
          paletteColors: visualizerSettings.paletteColors,
          hueShift: visualizerSettings.hueShift,
          autoCycle: visualizerSettings.autoCycle,
          cycleSpeed: visualizerSettings.cycleSpeed,
          barCount: visualizerSettings.barCount,
          glow: visualizerSettings.glow,
          intensity: visualizerSettings.intensity,
        })
      )
    } catch {
      // Ignore storage failures (e.g. private mode quota limits).
    }
  }, [visualizerSettings])

  useEffect(() => {
  try {
    if (lastSongName) {
      localStorage.setItem(LAST_SONG_NAME_STORAGE_KEY, lastSongName)
    }
  } catch {
    // Ignore storage write errors.
  }
  }, [lastSongName])


  return (
    <main className="app">
      <h1>Audio Visualizer</h1>
      <FileUpload onFileSelect={handleFileSelect} />
      <SongInfo fileName={fileName} metadata={metadata} />

      {/* Hidden audio element is the playback engine for Web Audio + custom controls. */}
      {audioUrl && <audio ref={audioRef} src={audioUrl} style={{ display: "none" }} />}

      <button
        className="viz-toggle"
        onClick={() => setVizMode((m) => (m === "bars" ? "radial" : "bars"))}
        disabled={!hasAudio}
      >
        Mode: {vizMode === "bars" ? "Bars" : "Radial"}
      </button>

      <CustomizerPanel
        settings={visualizerSettings}
        onChange={setVisualizerSettings}
        disabled={!hasAudio}
      />

       <button className="reset-ui-btn" onClick={handleResetSavedUi} type="button">
          Reset Saved UI
        </button>


      {audioUrl && (
        <Visualizer
          analyzerData={analyzerData}
          mode={vizMode}
          settings={visualizerSettings}
        />
      )}

      {!hasAudio && (
        <>
          <p className="empty-state">Upload an audio file to start the visualizer.</p>
          {lastSongName && (
            <p className="privacy-note">Last uploaded: {lastSongName}</p>
          )}
        </>
      )}


      <p className="privacy-note">Your audio files never leave your browser.</p>

      <AudioPlayer audioRef={audioRef} audioUrl={audioUrl} />
    </main>
  )
}

export default App
