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
  const [repeatMode, setRepeatMode] = useState("off") 
  const [isShuffleOn, setIsShuffleOn] = useState(false)

  const hasAudio = Boolean(activeTrack)
  const hasPreviousTrack = Boolean(getPreviousTrackId(queue, activeTrackId))
  const hasNextTrack = Boolean(getNextTrackId(queue, activeTrackId))
  const isLoadingMetadata = activeTrack?.status === "loading"

  const [queueStatus, setQueueStatus] = useState(null) // { id, text } | null
  const queueStatusTimerRef = useRef(null)

  const upNextTrack = (() => {
    if (!activeTrack) return null
    if (repeatMode === "one") return activeTrack
    if (isShuffleOn) return { name: "Random (Shuffle)" }
    const nextId = getNextTrackId(queue, activeTrack.id)
    if (nextId) return queue.find((track) => track.id === nextId) || null
    if (repeatMode === "all" && queue.length > 0) return queue[0]
    return null
  })()

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
    setActiveTrackId((previousId) => getNextTrackIdByMode(queue, previousId))
  }

  function playPreviousTrack() {
    setActiveTrackId((previousId) => {
      const previousTrackId = getPreviousTrackId(queue, previousId)
      return previousTrackId ?? previousId
    })
  }
  
  function getRandomTrackId(tracks, excludeTrackId) {
    const candidates = tracks.filter((track) => track.id !== excludeTrackId)
    if (!candidates.length) return excludeTrackId
    const index = Math.floor(Math.random() * candidates.length)
    return candidates[index].id
  }

  function getNextTrackIdByMode(tracks, currentId) {
    if (!tracks.length) return currentId
    if (isShuffleOn) {
      return getRandomTrackId(tracks, currentId)
    }
    const nextTrackId = getNextTrackId(tracks, currentId)
    if (!nextTrackId && repeatMode === "all") {
      return tracks[0].id
    }
    return nextTrackId ?? currentId
  }

  function getFileFingerprint(file) {
    return `${file.name}__${file.size}__${file.lastModified}`
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

  function handleReorderById(sourceTrackId, targetTrackId) {
    setQueue((previousQueue) => {
      const fromIndex = previousQueue.findIndex((track) => track.id === sourceTrackId)
      const toIndex = previousQueue.findIndex((track) => track.id === targetTrackId)
      if (fromIndex === -1 || toIndex === -1) return previousQueue
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
    const existingFingerprints = new Set(
      queue.map((track) => getFileFingerprint(track.file))
    )
    const duplicateFiles = files.filter((file) =>
      existingFingerprints.has(getFileFingerprint(file))
    )
    let filesToAdd = files
    if (duplicateFiles.length) {
      const duplicateNames = [...new Set(duplicateFiles.map((file) => file.name))]
      const preview = duplicateNames.slice(0, 5).join("\n- ")
      const extra =
        duplicateNames.length > 5
          ? `\n- ...and ${duplicateNames.length - 5} more`
          : ""
      const shouldAddDuplicates = window.confirm(
        `These file(s) are already in the queue:\n- ${preview}${extra}\n\nAdd them anyway?`
      )
      if (!shouldAddDuplicates) {
        filesToAdd = files.filter(
          (file) => !existingFingerprints.has(getFileFingerprint(file))
        )
      }
    }

    const skippedCount = files.length - filesToAdd.length
    if (!filesToAdd.length) {
      if (skippedCount > 0) {
        showQueueStatus("No new files added.")
      }
      return
    }

    if (!filesToAdd.length) return
    const tracks = filesToAdd.map(createTrack)

    if (skippedCount > 0) {
      showQueueStatus(`Added ${tracks.length} file(s). Skipped ${skippedCount}.`)
    } else {
      showQueueStatus(`Added ${tracks.length} file(s) to queue.`)
    }

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

  function showQueueStatus(text) {
    if (queueStatusTimerRef.current) {
      clearTimeout(queueStatusTimerRef.current)
    }
    // id forces re-render even if text is identical
    setQueueStatus({ id: Date.now(), text })
    queueStatusTimerRef.current = setTimeout(() => {
      setQueueStatus(null)
      queueStatusTimerRef.current = null
    }, 2200)
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
      if (repeatMode === "one") {
        audio.currentTime = 0
        audio.play()
        return
      }
      setActiveTrackId((previousId) => getNextTrackIdByMode(queue, previousId))
    }
    audio.addEventListener("ended", onEnded)
    return () => audio.removeEventListener("ended", onEnded)
  }, [queue, repeatMode, isShuffleOn])

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

  useEffect(() => {
    return () => {
      if (queueStatusTimerRef.current) {
        clearTimeout(queueStatusTimerRef.current)
      }
    }
  }, [])



  return (
    <main className="app">
      <h1>Audio Visualizer</h1>
      <FileUpload onFilesSelect={enqueueFiles} />
      {queueStatus && (
        <p key={queueStatus.id} className="upload-error" role="status" aria-live="polite">
          {queueStatus.text}
        </p>
      )}
      <SongInfo fileName={activeTrack?.name || ""} metadata={activeTrack?.metadata} />
      {activeTrack && (
      <section className="now-playing-panel">
          <p className="now-playing-line">
            <span className="now-playing-label">Now Playing:</span>{" "}
            {activeTrack.metadata?.title?.trim() || activeTrack.name}
          </p>
          <p className="now-playing-line">
            <span className="now-playing-label">Up Next:</span>{" "}
            {upNextTrack ? (upNextTrack.metadata?.title?.trim() || upNextTrack.name) : "None"}
          </p>
          <div className="playback-mode-chips">
            <span className={`mode-chip ${isShuffleOn ? "mode-chip--active" : ""}`}>
              Shuffle: {isShuffleOn ? "On" : "Off"}
            </span>
            <span className={`mode-chip ${repeatMode !== "off" ? "mode-chip--active" : ""}`}>
              Repeat: {repeatMode === "off" ? "Off" : repeatMode === "one" ? "One" : "All"}
            </span>
          </div>
        </section>
      )}

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
        onReorderById={handleReorderById}
        onMoveUp={handleMoveTrackUp}
        onMoveDown={handleMoveTrackDown}
      />

      <section className="visualizer-controls-stack">
        <button
          className="viz-toggle"
          onClick={() => setVizMode((m) => (m === "bars" ? "radial" : 
      "bars"))}
          disabled={!hasAudio}
        >
          Mode: {vizMode === "bars" ? "Bars" : "Radial"}
        </button>
        <CustomizerPanel
          settings={visualizerSettings}
          onChange={setVisualizerSettings}
          disabled={!hasAudio}
        />
        <button className="reset-ui-btn" onClick={handleResetSavedUi} 
      type="button">
          Reset Saved UI
        </button>
      </section>



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
        repeatMode={repeatMode}
        onRepeatModeChange={setRepeatMode}
        isShuffleOn={isShuffleOn}
        onShuffleToggle={() => setIsShuffleOn((prev) => !prev)}
      />
    </main>
  )
}

export default App
