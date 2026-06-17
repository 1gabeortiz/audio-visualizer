import { useEffect, useState } from "react"

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00"
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

function AudioPlayer({
    audioRef,
    audioUrl,
    onNextTrack,
    onPreviousTrack,
    hasNextTrack = false,
    hasPreviousTrack = false,
    repeatMode = "off",
    onRepeatModeChange,
    isShuffleOn = false,
    onShuffleToggle,
  }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const SEEK_SECONDS = 5
  const VOLUME_STEP = 0.05
  function isTypingInInput(target) {
    if (!(target instanceof HTMLElement)) return false
    if (target.isContentEditable) return true
    const tag = target.tagName
    if (tag === "TEXTAREA" || tag === "SELECT") return true
    if (tag === "INPUT") {
      const type = (target.getAttribute("type") || "text").toLowerCase()
      // Allow shortcuts when sliders/ranges are focused.
      if (type === "range") return false
      // Block shortcuts for text-like fields only.
      const textLikeTypes = new Set([
        "text",
        "search",
        "email",
        "password",
        "url",
        "tel",
        "number",
        "date",
        "datetime-local",
        "month",
        "week",
        "time",
      ])
      return textLikeTypes.has(type)
    }
    return false
  }


  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    // Keep React state in sync with the hidden audio element's native events.
    function onTimeUpdate() {
      setCurrentTime(audio.currentTime)
    }

    function onLoadedMetadata() {
      setDuration(audio.duration || 0)
    }

    function onEnded() {
      setIsPlaying(false)
    }

    function onPlay() {
      setIsPlaying(true)
    }

    function onPause() {
      setIsPlaying(false)
    }

    audio.addEventListener("timeupdate", onTimeUpdate)
    audio.addEventListener("loadedmetadata", onLoadedMetadata)
    audio.addEventListener("ended", onEnded)
    audio.addEventListener("play", onPlay)
    audio.addEventListener("pause", onPause)

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate)
      audio.removeEventListener("loadedmetadata", onLoadedMetadata)
      audio.removeEventListener("ended", onEnded)
      audio.removeEventListener("play", onPlay)
      audio.removeEventListener("pause", onPause)
    }
  }, [audioRef, audioUrl])

  useEffect(() => {
    if (!audioUrl) return
    function onKeyDown(e) {
      if (isTypingInInput(e.target)) return
      const audio = audioRef.current
      if (!audio) return
      switch (e.code) {
        case "Space":
          e.preventDefault()
          if (audio.paused) {
            audio.play().catch(() => {
              setIsPlaying(false)
            })
          } else {
            audio.pause()
          }
          break
        case "ArrowRight":
          e.preventDefault()
          audio.currentTime = Math.min(
            Number.isFinite(audio.duration) ? audio.duration : 
            audio.currentTime + SEEK_SECONDS,
            audio.currentTime + SEEK_SECONDS
          )
          setCurrentTime(audio.currentTime)
          break
        case "ArrowLeft":
          e.preventDefault()
          audio.currentTime = Math.max(0, audio.currentTime - SEEK_SECONDS)
          setCurrentTime(audio.currentTime)
          break
        case "ArrowUp":
          e.preventDefault()
          audio.volume = Math.min(1, audio.volume + VOLUME_STEP)
          setVolume(audio.volume)
          break
        case "ArrowDown":
          e.preventDefault()
          audio.volume = Math.max(0, audio.volume - VOLUME_STEP)
          setVolume(audio.volume)
          break
        case "KeyM":
          e.preventDefault()
          audio.muted = !audio.muted
          break
        case "KeyN":
          if (!hasNextTrack || !onNextTrack) return
          e.preventDefault()
          onNextTrack()
          break
        case "KeyP":
          if (!hasPreviousTrack || !onPreviousTrack) return
          e.preventDefault()
          onPreviousTrack()
          break
        case "KeyS":
          e.preventDefault()
          onShuffleToggle?.()
          break
        case "KeyR":
          e.preventDefault()
          if (onRepeatModeChange) {
            const order = ["off", "one", "all"]
            const currentIndex = order.indexOf(repeatMode)
            const nextMode = order[(currentIndex + 1) % order.length]
            onRepeatModeChange(nextMode)
          }
          break
        default:
          break
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [
    audioRef,
    audioUrl,
    hasNextTrack,
    hasPreviousTrack,
    onNextTrack,
    onPreviousTrack,
    onShuffleToggle,
    repeatMode,
    onRepeatModeChange,
  ])



  function togglePlay() {
    const audio = audioRef.current
    if (!audio) return

    // The hidden <audio> element is the source of truth for playback state.
    if (audio.paused) {
      audio.play().catch(() => {
        setIsPlaying(false)
      })
    } else {
      audio.pause()
    }
  }

  function handleSeek(e) {
    const audio = audioRef.current
    if (!audio) return
    const nextTime = Number(e.target.value)
    audio.currentTime = nextTime
    setCurrentTime(nextTime)
  }

  function handleVolume(e) {
    const audio = audioRef.current
    if (!audio) return
    const nextVolume = Number(e.target.value)
    audio.volume = nextVolume
    setVolume(nextVolume)
  }

  function restartTrack() {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = 0
    setCurrentTime(0)
  }

  function skipToEnd() {
    const audio = audioRef.current
    if (!audio || !Number.isFinite(audio.duration)) return
    audio.currentTime = audio.duration
    setCurrentTime(audio.duration)
    setIsPlaying(false)
  }

  function cycleRepeatMode() {
    if (!onRepeatModeChange) return
    const order = ["off", "one", "all"]
    const currentIndex = order.indexOf(repeatMode)
    const nextMode = order[(currentIndex + 1) % order.length]
    onRepeatModeChange(nextMode)
  }

  if (!audioUrl) return null

  return (
    <section className="player player--stage">
      <div className="player-top-row">
        <div className="player-side-controls">
          <button
            className={`player-btn player-btn--icon player-shuffle-btn ${
              isShuffleOn ? "player-btn--active" : ""
            }`}
            type="button"
            onClick={onShuffleToggle}
            aria-pressed={isShuffleOn}
            aria-label={`Shuffle ${isShuffleOn ? "on" : "off"}`}
            title={isShuffleOn ? "Shuffle on" : "Shuffle off"}
          >
            ⇄
          </button>
          <button
            className="player-btn player-btn--icon"
            type="button"
            onClick={onPreviousTrack}
            disabled={!hasPreviousTrack}
            aria-label="Play previous track"
            title="Previous track (P)"
          >
            ↶
          </button>
        </div>
        <div className="player-transport-controls">
          <button
            className="player-btn player-btn--icon"
            type="button"
            onClick={restartTrack}
            aria-label="Restart track"
            title="Restart"
          >
            ⏮
          </button>
          <button
            className={`player-btn player-btn--primary player-btn--icon ${
              isPlaying ? "player-btn--active" : ""
            }`}
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? "Pause" : "Play"}
            aria-pressed={isPlaying}
            title={isPlaying ? "Pause (Space)" : "Play (Space)"}
          >
            {isPlaying ? "⏸" : "▶"}
          </button>
          <button
            className="player-btn player-btn--icon"
            type="button"
            onClick={skipToEnd}
            aria-label="Skip to end"
            title="Skip to end"
          >
            ⏭
          </button>
        </div>
        <div className="player-side-controls player-side-controls--right">
          <button
            className="player-btn player-btn--icon"
            type="button"
            onClick={onNextTrack}
            disabled={!hasNextTrack}
            aria-label="Play next track"
            title="Next track (N)"
          >
            ↷
          </button>
          <button
            className={`player-btn player-btn--icon player-repeat-btn ${
              repeatMode !== "off" ? "player-btn--active" : ""
            }`}
            type="button"
            onClick={cycleRepeatMode}
            aria-pressed={repeatMode !== "off"}
            aria-label={`Repeat mode: ${
              repeatMode === "off" ? "off" : repeatMode === "one" ? "one" : "all"
            }`}
            title={
              repeatMode === "off"
                ? "Repeat off"
                : repeatMode === "one"
                  ? "Repeat one"
                  : "Repeat all"
            }
          >
            {repeatMode === "one" ? "↻1" : "↻"}
          </button>
          <label className="player-volume player-volume--compact">
            <span aria-hidden="true">🔊</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              aria-label="Volume"
              onChange={handleVolume}
            />
          </label>
        </div>
      </div>
      <div className="player-progress-row">
        <span className="player-time">{formatTime(currentTime)}</span>
        <input
          className="player-seek"
          type="range"
          min="0"
          max={duration || 0}
          step="0.01"
          aria-label="Seek position"
          value={currentTime}
          onChange={handleSeek}
        />
        <span className="player-time">{formatTime(duration)}</span>
      </div>
      <p className="player-shortcuts">
        Shortcuts: Space play/pause, ←/→ seek, ↑/↓ volume, M mute, P/N previous/next, S shuffle, R repeat
      </p>
    </section>
  )
}

export default AudioPlayer
