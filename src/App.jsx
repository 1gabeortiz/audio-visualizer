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
  const hasPreviousTrack = canGoPrevious()
  const hasNextTrack = canGoNext()
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
    setActiveTrackId((previousId) => {
      const nextId = resolveNextTrackId(previousId)
      return nextId ?? previousId
    })
  }
  function playPreviousTrack() {
    setActiveTrackId((previousId) => {
      const prevId = resolvePreviousTrackId(previousId)
      return prevId ?? previousId
    })
  }

  
  function getRandomTrackId(tracks, excludeTrackId) {
    const candidates = tracks.filter((track) => track.id !== excludeTrackId)
    if (!candidates.length) return excludeTrackId
    const index = Math.floor(Math.random() * candidates.length)
    return candidates[index].id
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

  function canGoNext() {
    if (queue.length <= 1) return false
    if (isShuffleOn) return true
    if (repeatMode === "all") return true
    return Boolean(getNextTrackId(queue, activeTrackId))
  }

  function canGoPrevious() {
    if (queue.length <= 1) return false
    if (repeatMode === "all") return true
    return Boolean(getPreviousTrackId(queue, activeTrackId))
  }

  function resolveNextTrackId(currentId, { isEnded = false } = {}) {
    if (!queue.length) return null
    if (!currentId) return queue[0].id
    if (isEnded && repeatMode === "one") {
      return currentId
    }
    if (isShuffleOn && queue.length > 1) {
      return getRandomTrackId(queue, currentId)
    }
    const linearNextId = getNextTrackId(queue, currentId)
    if (linearNextId) return linearNextId
    if (repeatMode === "all") return queue[0].id
    return currentId
  }

  function resolvePreviousTrackId(currentId) {
    if (!queue.length) return null
    if (!currentId) return queue[0].id
    const linearPrevId = getPreviousTrackId(queue, currentId)
    if (linearPrevId) return linearPrevId
    if (repeatMode === "all" && queue.length > 0) {
      return queue[queue.length - 1].id
    }
    return currentId
  }

  function handleReorderToIndex(sourceTrackId, rawInsertIndex) {
    setQueue((previousQueue) => {
      const fromIndex = previousQueue.findIndex((track) => track.id === sourceTrackId)
      if (fromIndex === -1) return previousQueue
      const boundedInsertIndex = Math.max(0, Math.min(rawInsertIndex, previousQueue.length))
      let toIndex = boundedInsertIndex
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

  function handleClearQueue() {
    if (!queue.length) return
    const confirmed = window.confirm("Clear the entire queue?")
    if (!confirmed) return
    setQueue((previousQueue) => {
      previousQueue.forEach((track) => revokeTrackResources(track))
      return []
    })
    setActiveTrackId(null)
  }
  function handleKeepCurrentOnly() {
    if (!activeTrackId || queue.length <= 1) return
    const confirmed = window.confirm("Remove all queued songs except the current one?")
    if (!confirmed) return
    setQueue((previousQueue) => {
      const current = previousQueue.find((track) => track.id === 
  activeTrackId)
      if (!current) return []
      previousQueue.forEach((track) => {
        if (track.id !== activeTrackId) revokeTrackResources(track)
      })
      return [current]
    })
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
  }



  useEffect(() => {
    if (activeAudioUrl && audioRef.current) {
      audioRef.current.load()
      audioRef.current.play().catch(() => {
        // Browser may block autoplay until user interaction.
      })
    }
  }, [activeAudioUrl])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.loop = repeatMode === "one"
    return () => {
      audio.loop = false
    }
  }, [repeatMode, activeAudioUrl])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    function onEnded() {
      setActiveTrackId((previousId) => {
        if (!queue.length) return previousId
        if (!previousId) return queue[0].id
        if (isShuffleOn && queue.length > 1) return getRandomTrackId(queue, previousId)

        const linearNextId = getNextTrackId(queue, previousId)
        if (linearNextId) return linearNextId
        if (repeatMode === "all") return queue[0].id

        const nextId = previousId
        return nextId ?? previousId
      })
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
      <section className="app-top">
        <h1>Audio Visualizer</h1>
        <FileUpload onFilesSelect={enqueueFiles} />
        {queueStatus && (
          <p
            key={queueStatus.id}
            className="upload-error"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {queueStatus.text}
          </p>
        )}
      </section>
      {/* Hidden audio element remains global playback engine */}
      {activeAudioUrl && <audio ref={audioRef} src={activeAudioUrl} style={{ display: "none" }} />}
      <div className="app-shell">
        <aside className="shell-left">
          <QueuePanel
            queue={queue}
            activeTrackId={activeTrackId}
            onAddFiles={enqueueFiles}
            onPlayTrack={playTrackById}
            onRemoveTrack={handleRemoveTrack}
            onReorderToIndex={handleReorderToIndex}
            onMoveUp={handleMoveTrackUp}
            onMoveDown={handleMoveTrackDown}
            onClearQueue={handleClearQueue}
            onKeepCurrentOnly={handleKeepCurrentOnly}
          />
        </aside>
        <section className="shell-center">
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
          {isLoadingMetadata && <p className="privacy-note">Reading metadata...</p>}
          {activeAudioUrl && (
            <Visualizer analyzerData={analyzerData} mode={vizMode} settings={visualizerSettings} />
          )}
          {!hasAudio && (
            <>
              <p className="empty-state">Upload an audio file to start the visualizer.</p>
              {lastSongName && <p className="privacy-note">Last uploaded: {lastSongName}</p>}
            </>
          )}
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
          <p className="privacy-note">Your audio files never leave your browser.</p>
        </section>
        <aside className="shell-right">
          <section className="visualizer-controls-stack">
            <button
              className="viz-toggle"
              onClick={() => setVizMode((m) => (m === "bars" ? "radial" : "bars"))}
            >
              Mode: {vizMode === "bars" ? "Bars" : "Radial"}
            </button>
            <CustomizerPanel settings={visualizerSettings} onChange={setVisualizerSettings} />
            <button className="reset-ui-btn" onClick={handleResetSavedUi} type="button">
              Reset Saved UI
            </button>
          </section>
        </aside>
      </div>
    </main>
  )
}

export default App
