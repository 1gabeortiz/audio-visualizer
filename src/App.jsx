import { useEffect, useRef, useState } from "react"
import FileUpload from "./components/FileUpload"
import SongInfo from "./components/SongInfo"
import { readMetadata } from "./utils/readMetadata"
import AudioPlayer from "./components/AudioPlayer"
import Visualizer from "./components/Visualizer"
import useAudioAnalyzer from "./hooks/useAudioAnalyzer"

function App() {
  const [audioUrl, setAudioUrl] = useState(null)
  const [fileName, setFileName] = useState("")
  const [metadata, setMetadata] = useState(null)
  const audioRef = useRef(null)
  const currentAudioUrlRef = useRef(null)
  const currentCoverUrlRef = useRef(null)
  const metadataRequestIdRef = useRef(0)
  const analyzerData = useAudioAnalyzer(audioRef, audioUrl)
  const [vizMode, setVizMode] = useState("bars")

  async function handleFileSelect(file) {
    if (currentAudioUrlRef.current) URL.revokeObjectURL(currentAudioUrlRef.current)
    if (currentCoverUrlRef.current) URL.revokeObjectURL(currentCoverUrlRef.current)

    const nextAudioUrl = URL.createObjectURL(file)
    const nextRequestId = metadataRequestIdRef.current + 1
    metadataRequestIdRef.current = nextRequestId

    currentAudioUrlRef.current = nextAudioUrl
    setAudioUrl(nextAudioUrl)
    setFileName(file.name.replace(/\.[^/.]+$/, ""))

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
      {audioUrl && <audio ref={audioRef} src={audioUrl} style={{ display: "none" }} />}
      <button
        className="viz-toggle"
        onClick={() => setVizMode((m) => (m === "bars" ? "radial" : "bars"))}
      >
        Mode: {vizMode === "bars" ? "Bars" : "Radial"}
      </button>
      {audioUrl && <Visualizer analyzerData={analyzerData} mode={vizMode} />}
      <AudioPlayer audioRef={audioRef} audioUrl={audioUrl} />
    </main>
  )
}

export default App
