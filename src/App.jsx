import { useEffect, useRef, useState } from "react"
   import FileUpload from "./components/FileUpload"
   import SongInfo from "./components/SongInfo"
   import { readMetadata } from "./utils/readMetadata"
   
   function App() {
     const [audioUrl, setAudioUrl] = useState(null)
     const [fileName, setFileName] = useState("")
     const [metadata, setMetadata] = useState(null)
   
     const audioRef = useRef(null)
     const currentAudioUrlRef = useRef(null)
     const currentCoverUrlRef = useRef(null)
   
     async function handleFileSelect(file) {
       if (currentAudioUrlRef.current) URL.revokeObjectURL(currentAudioUrlRef.current)
       if (currentCoverUrlRef.current) URL.revokeObjectURL(currentCoverUrlRef.current)
   
       const nextAudioUrl = URL.createObjectURL(file)
       currentAudioUrlRef.current = nextAudioUrl
       setAudioUrl(nextAudioUrl)
       setFileName(file.name.replace(/\.[^/.]+$/, ""))
   
       const nextMetadata = await readMetadata(file)
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
         {audioUrl && <audio ref={audioRef} controls src={audioUrl} />}
       </main>
     )
   }
   
   export default App
