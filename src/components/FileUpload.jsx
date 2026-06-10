import { useRef, useEffect, useState } from "react"

const ACCEPTED_TYPES = ["audio/mpeg", "audio/wav"]
const MAX_SIZE_MB = 150

function FileUpload({ onFileSelect }) {
  const inputRef = useRef(null)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

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
      setErrorMessage("Please upload an MP3 or WAV file.")
      return false
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setErrorMessage(`File must be under ${MAX_SIZE_MB}MB.`)
      return false
    }
    setErrorMessage("")
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

  function handleKeyDown(e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      inputRef.current.click()
    }
  }

  return (
    <>
      <div
        className={`upload-zone ${isDraggingOver ? "upload-zone--active" : ""}`}
        onClick={() => inputRef.current.click()}
        onKeyDown={handleKeyDown}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        role="button"
        tabIndex={0}
        aria-label="Upload an audio file by dragging and dropping or clicking to browse"
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
      {errorMessage && (
        <p className="upload-error" role="status" aria-live="polite">
          {errorMessage}
        </p>
      )}
    </>
  )
}

export default FileUpload
