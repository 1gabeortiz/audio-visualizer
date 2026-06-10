import { useEffect, useState } from "react"

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00"
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

function AudioPlayer({ audioRef, audioUrl }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)

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

  if (!audioUrl) return null

  return (
    <section className="player">
      <div className="player-controls">
        <button className="player-btn" type="button" onClick={restartTrack}>
          Restart
        </button>
        <button
          className={`player-btn player-btn--primary ${isPlaying ? "player-btn--active" : ""}`}
          type="button"
          onClick={togglePlay}
        >
          {isPlaying ? "Pause" : "Play"}
        </button>
        <button className="player-btn" type="button" onClick={skipToEnd}>
          Skip to End
        </button>
      </div>

      <span className="player-time">{formatTime(currentTime)}</span>
      <input
        className="player-seek"
        type="range"
        min="0"
        max={duration || 0}
        step="0.01"
        value={currentTime}
        onChange={handleSeek}
      />
      <span className="player-time">{formatTime(duration)}</span>

      <label className="player-volume">
        Vol
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={handleVolume}
        />
      </label>
    </section>
  )
}

export default AudioPlayer
