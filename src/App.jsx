import { useEffect, useRef, useState } from "react"
import FileUpload from "./components/FileUpload"
import SongInfo from "./components/SongInfo"
import { readMetadata } from "./utils/readMetadata"
import AudioPlayer from "./components/AudioPlayer"
import Visualizer from "./components/Visualizer"
import useAudioAnalyzer from "./hooks/useAudioAnalyzer"
import CustomizerPanel from "./components/CustomizerPanel"
import QueuePanel from "./components/QueuePanel"
import { sanitizeVisualizerPreset } from "./utils/presets"
import {
  getNextTrackId,
  getPreviousTrackId,
  moveQueueItem,
} from "./utils/queue"

const VISUALIZER_SETTINGS_STORAGE_KEY = "audio-viz-current-settings"
const VISUALIZER_MODE_STORAGE_KEY = "audio-viz-mode"
const LAST_SONG_NAME_STORAGE_KEY = "audio-viz-last-song-name"

function loadInitialVisualizerMode() {
  try {
    const savedMode = localStorage.getItem(VISUALIZER_MODE_STORAGE_KEY)
    return savedMode === "bars" || savedMode === "radial" ? savedMode : "bars"
  } catch {
    return "bars"
  }
}

function createTrackId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID()
  return `track-${Date.now()}-${Math.floor(Math.random() * 100000)}`
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

function loadLastSongName() {
  try {
    return localStorage.getItem(LAST_SONG_NAME_STORAGE_KEY) || ""
  } catch {
    return ""
  }
}

function createTrack(file) {
  return {
    id: createTrackId(),
    file,
    name: file.name.replace(/\.[^/.]+$/, ""),
    audioUrl: URL.createObjectURL(file),
    metadata: null,
    status: "loading",
    errorMessage: null,
  }
}

function revokeTrackResources(track) {
  if (track.audioUrl) URL.revokeObjectURL(track.audioUrl)
  if (track.metadata?.coverUrl) URL.revokeObjectURL(track.metadata.coverUrl)
}

function App() {
  const [queue, setQueue] = useState([])
  const [activeTrackId, setActiveTrackId] = useState(null)
  const [lastSongName, setLastSongName] = useState(loadLastSongName)

  const audioRef = useRef(null)
  const queueRef = useRef(queue)

  const activeTrack = queue.find((track) => track.id === activeTrackId) || null
  const activeAudioUrl = activeTrack?.audioUrl || null
  const analyzerData = useAudioAnalyzer(audioRef, activeAudioUrl)
  const [vizMode, setVizMode] = useState(loadInitialVisualizerMode)
  const [visualizerSettings, setVisualizerSettings] = useState(loadInitialVisualizerSettings)

  const hasAudio = Boolean(activeTrack)
  const hasPreviousTrack = Boolean(getPreviousTrackId(queue, activeTrackId))
  const hasNextTrack = Boolean(getNextTrackId(queue, activeTrackId))
  const isLoadingMetadata = activeTrack?.status === "loading"

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

  function playTrackById(trackId) {
    if (!trackId) return
    setActiveTrackId(trackId)
  }

  function playNextTrack() {
    setActiveTrackId((previousId) => {
      const nextTrackId = getNextTrackId(queue, previousId)
      return nextTrackId ?? previousId
    })
  }

  function playPreviousTrack() {
    setActiveTrackId((previousId) => {
      const previousTrackId = getPreviousTrackId(queue, previousId)
      return previousTrackId ?? previousId
    })
  }

  function handleRemoveTrack(trackId) {
    let nextActiveTrackId = activeTrackId
    setQueue((previousQueue) => {
      const removeIndex = previousQueue.findIndex((track) => track.id === trackId)
      if (removeIndex === -1) return previousQueue

      const trackToRemove = previousQueue[removeIndex]
      revokeTrackResources(trackToRemove)

      const nextQueue = previousQueue.filter((track) => track.id !== trackId)
      if (trackId === activeTrackId) {
        const replacement = nextQueue[removeIndex] || nextQueue[removeIndex - 1] || null
        nextActiveTrackId = replacement ? replacement.id : null
      }
      return nextQueue
    })
    if (trackId === activeTrackId) setActiveTrackId(nextActiveTrackId)
  }

  function handleReorderToIndex(sourceTrackId, rawInsertIndex) {
    setQueue((previousQueue) => {
      const fromIndex = previousQueue.findIndex((track) => track.id === sourceTrackId)
      if (fromIndex === -1) return previousQueue
      const boundedInsertIndex = Math.max(0, Math.min(rawInsertIndex, previousQueue.length))
      let toIndex = boundedInsertIndex
      // When moving downward, removing source shifts index left by one.
      if (fromIndex < toIndex) toIndex -= 1
      if (toIndex === fromIndex) return previousQueue
      return moveQueueItem(previousQueue, fromIndex, toIndex)
    })
  }


  function handleMoveTrackUp(trackId) {
    setQueue((previousQueue) => {
      const index = previousQueue.findIndex((track) => track.id === trackId)
      if (index <= 0) return previousQueue
      return moveQueueItem(previousQueue, index, index - 1)
    })
  }

  function handleMoveTrackDown(trackId) {
    setQueue((previousQueue) => {
      const index = previousQueue.findIndex((track) => track.id === trackId)
      if (index === -1 || index >= previousQueue.length - 1) return previousQueue
      return moveQueueItem(previousQueue, index, index + 1)
    })
  }

  function enqueueFiles(files) {
    if (!files.length) return
    const tracks = files.map(createTrack)

    setQueue((previousQueue) => [...previousQueue, ...tracks])
    setActiveTrackId((previousTrackId) => previousTrackId ?? tracks[0].id)
    setLastSongName(tracks[tracks.length - 1].name)

    tracks.forEach((track) => {
      readMetadata(track.file)
        .then((nextMetadata) => {
          setQueue((previousQueue) => {
            const index = previousQueue.findIndex((item) => item.id === track.id)
            if (index === -1) {
              if (nextMetadata?.coverUrl) URL.revokeObjectURL(nextMetadata.coverUrl)
              return previousQueue
            }

            const nextQueue = [...previousQueue]
            nextQueue[index] = {
              ...nextQueue[index],
              metadata: nextMetadata,
              status: "ready",
              errorMessage: null,
            }
            return nextQueue
          })
        })
        .catch(() => {
          setQueue((previousQueue) =>
            previousQueue.map((item) =>
              item.id === track.id
                ? {
                    ...item,
                    status: "error",
                    errorMessage: "Could not read metadata",
                  }
                : item
            )
          )
        })
    })
  }

  useEffect(() => {
    if (activeAudioUrl && audioRef.current) {
      audioRef.current.load()
      audioRef.current.play()
    }
  }, [activeAudioUrl])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    function onEnded() {
      setActiveTrackId((previousTrackId) => {
        const nextTrackId = getNextTrackId(queue, previousTrackId)
        return nextTrackId ?? previousTrackId
      })
    }

    audio.addEventListener("ended", onEnded)
    return () => audio.removeEventListener("ended", onEnded)
  }, [queue])

  useEffect(() => {
    queueRef.current = queue
  }, [queue])

  useEffect(() => {
    return () => {
      queueRef.current.forEach((track) => revokeTrackResources(track))
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
      } else {
        localStorage.removeItem(LAST_SONG_NAME_STORAGE_KEY)
      }
    } catch {
      // Ignore storage write errors.
    }
  }, [lastSongName])


  return (
    <main className="app">
      <h1>Audio Visualizer</h1>
      <FileUpload onFilesSelect={enqueueFiles} />
      <SongInfo fileName={activeTrack?.name || ""} metadata={activeTrack?.metadata} />

      {isLoadingMetadata && (
      <p className="privacy-note">Reading metadata...</p>)}


      {/* Hidden audio element is the playback engine for Web Audio + custom controls. */}
      {activeAudioUrl && <audio ref={audioRef} src={activeAudioUrl} style={{ display: "none" }} />}

      <QueuePanel
        queue={queue}
        activeTrackId={activeTrackId}
        onAddFiles={enqueueFiles}
        onPlayTrack={playTrackById}
        onRemoveTrack={handleRemoveTrack}
        onReorderToIndex={handleReorderToIndex}
        onMoveUp={handleMoveTrackUp}
        onMoveDown={handleMoveTrackDown}
      />

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


      {activeAudioUrl && (
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

      <AudioPlayer
        audioRef={audioRef}
        audioUrl={activeAudioUrl}
        hasPreviousTrack={hasPreviousTrack}
        hasNextTrack={hasNextTrack}
        onPreviousTrack={playPreviousTrack}
        onNextTrack={playNextTrack}
      />
    </main>
  )
}

export default App
