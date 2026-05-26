import { useState, useRef, useEffect } from "react"
   import FileUpload from "./components/FileUpload"
   
   function App() {
     const [audioUrl, setAudioUrl] = useState(null)
     const audioRef = useRef(null)
     const currentUrlRef = useRef(null)
   
     function handleFileSelect(file) {
       if (currentUrlRef.current) {
         URL.revokeObjectURL(currentUrlRef.current)
       }
       const url = URL.createObjectURL(file)
       currentUrlRef.current = url
       setAudioUrl(url)
     }
   
     useEffect(() => {
       if (audioUrl && audioRef.current) {
         audioRef.current.load()
         audioRef.current.play()
       }
     }, [audioUrl])
   
     return (
       <div className="app">
         <h1>Audio Visualizer</h1>
         <FileUpload onFileSelect={handleFileSelect} />
         {audioUrl && (
           <audio ref={audioRef} controls src={audioUrl} />
         )}
       </div>
     )
   }
   
   export default App