import { useEffect, useRef, useState } from "react"
import FileUpload from "./components/FileUpload"
import SongInfo from "./components/SongInfo"
import { readMetadata } from "./utils/readMetadata"
import AudioPlayer from "./components/AudioPlayer"
import Visualizer from "./components/Visualizer"
import useAudioAnalyzer from "./hooks/useAudioAnalyzer"
import CustomizerPanel from "./components/CustomizerPanel"

function App() {
  const [audioUrl, setAudioUrl] = useState(null)
  const [fileName, setFileName] = useState("")
  const [metadata, setMetadata] = useState(null)

  // Keep refs to generated object URLs so we can revoke them and avoid memory leaks.
  const audioRef = useRef(null)
  const currentAudioUrlRef = useRef(null)
  const currentCoverUrlRef = useRef(null)

  // Prevent older async metadata reads from overwriting a newer song selection.
  const metadataRequestIdRef = useRef(0)

  const analyzerData = useAudioAnalyzer(audioRef, audioUrl)
  const [vizMode, setVizMode] = useState("bars")
  // Controls consumed by the visualizer + customizer panel.
  const [visualizerSettings, setVisualizerSettings] = useState({
    intensity: 1,
    hueShift: 0,
    glow: 14,
    barCount: 96,
  })
  const hasAudio = Boolean(audioUrl)

  async function handleFileSelect(file) {
    if (currentAudioUrlRef.current) URL.revokeObjectURL(currentAudioUrlRef.current)
    if (currentCoverUrlRef.current) URL.revokeObjectURL(currentCoverUrlRef.current)

    const nextAudioUrl = URL.createObjectURL(file)
    const nextRequestId = metadataRequestIdRef.current + 1
    metadataRequestIdRef.current = nextRequestId

    currentAudioUrlRef.current = nextAudioUrl
    setAudioUrl(nextAudioUrl)
    setFileName(file.name.replace(/\.[^/.]+$/, ""))
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

      {audioUrl && (
        <Visualizer
          analyzerData={analyzerData}
          mode={vizMode}
          settings={visualizerSettings}
        />
      )}

      {!hasAudio && (
        <p className="empty-state">Upload an audio file to start the visualizer.</p>
      )}

      <p className="privacy-note">Your audio files never leave your browser.</p>

      <AudioPlayer audioRef={audioRef} audioUrl={audioUrl} />
    </main>
  )
}

export default App
