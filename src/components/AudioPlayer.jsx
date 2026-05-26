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
   
       function onTimeUpdate() {
         setCurrentTime(audio.currentTime)
       }
   
       function onLoadedMetadata() {
         setDuration(audio.duration || 0)
       }

       function onEnded() {
         setIsPlaying(false)
       }
   
       audio.addEventListener("timeupdate", onTimeUpdate)
       audio.addEventListener("loadedmetadata", onLoadedMetadata)
       audio.addEventListener("ended", onEnded)
   
       return () => {
         audio.removeEventListener("timeupdate", onTimeUpdate)
         audio.removeEventListener("loadedmetadata", onLoadedMetadata)
         audio.removeEventListener("ended", onEnded)
       }
     }, [audioRef, audioUrl])
   
     function togglePlay() {
       const audio = audioRef.current
       if (!audio) return
   
       if (audio.paused) {
         audio.play()
         setIsPlaying(true)
       } else {
         audio.pause()
         setIsPlaying(false)
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
         <button onClick={restartTrack}>Restart</button>
         <button onClick={togglePlay}>{isPlaying ? "Pause" : "Play"}</button>
         <button onClick={skipToEnd}>Skip to End</button>
         <span>{formatTime(currentTime)}</span>
         <input
           type="range"
           min="0"
           max={duration || 0}
           step="0.01"
           value={currentTime}
           onChange={handleSeek}
         />
         <span>{formatTime(duration)}</span>
   
         <label>
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

