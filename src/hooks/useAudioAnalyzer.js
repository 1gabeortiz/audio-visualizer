import { useEffect, useRef, useState } from "react"

function useAudioAnalyzer(audioRef, audioUrl) {
  const [analyzerData, setAnalyzerData] = useState(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const sourceRef = useRef(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !audioUrl) return

    // Create one AudioContext for the app lifecycle (browser best practice).
    if (!audioContextRef.current) {
      audioContextRef.current = new window.AudioContext()
    }

    const ctx = audioContextRef.current

    // MediaElementSource can only be created once per <audio> element.
    if (!sourceRef.current) {
      sourceRef.current = ctx.createMediaElementSource(audio)
      analyserRef.current = ctx.createAnalyser()
      analyserRef.current.fftSize = 2048
      sourceRef.current.connect(analyserRef.current)
      analyserRef.current.connect(ctx.destination)
    }

    const analyser = analyserRef.current
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    setAnalyzerData({ analyser, dataArray, bufferLength })

    return () => {
      setAnalyzerData(null)
    }
  }, [audioRef, audioUrl])

  return analyzerData
}

export default useAudioAnalyzer
