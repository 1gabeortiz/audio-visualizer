import { useRef, useEffect, useState } from "react"

const ACCEPTED_TYPES = ["audio/mpeg", "audio/wav"]
const MAX_SIZE_MB = 150

function FileUpload({ onFileSelect }) {
  const inputRef = useRef(null)
  const [isDraggingOver, setIsDraggingOver] = useState(false)

  // Prevent browser from opening dropped files anywhere on the page
  useEffect(() => {
    function preventBrowserDefault(e) {
      e.preventDefault()
    }
    window.addEventListener("dragover", preventBrowserDefault)
    window.addEventListener("drop", preventBrowserDefault)
    return () => {
      window.removeEventListener("dragover", preventBrowserDefault)
      window.removeEventListener("drop", preventBrowserDefault)
    }
  }, [])

  function validateFile(file) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      alert("Please upload an MP3 or WAV file.")
      return false
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      alert(`File must be under ${MAX_SIZE_MB}MB.`)
      return false
    }
    return true
  }

  function handleFileChange(e) {
    const file = e.target.files[0]
    if (file && validateFile(file)) onFileSelect(file)
  }

  function handleDrop(e) {
    e.preventDefault()
    setIsDraggingOver(false)
    const file = e.dataTransfer.files[0]
    if (file && validateFile(file)) onFileSelect(file)
  }

  function handleDragOver(e) {
    e.preventDefault()
    setIsDraggingOver(true)
  }

  function handleDragLeave() {
    setIsDraggingOver(false)
  }

  return (
    <div
      className={`upload-zone ${isDraggingOver ? "upload-zone--active" : ""}`}
      onClick={() => inputRef.current.click()}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <p>Drop an audio file here or click to browse</p>
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />
    </div>
  )
}

export default FileUpload
