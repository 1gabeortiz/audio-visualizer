import { useRef, useEffect, useState } from "react"

const ACCEPTED_TYPES = ["audio/mpeg", "audio/wav"]
const ACCEPTED_EXTENSIONS = [".mp3", ".wav"]
const MAX_SIZE_MB = 150

function FileUpload({ onFilesSelect }) {
  const fileInputRef = useRef(null)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [statusMessage, setStatusMessage] = useState("")

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

  function isAcceptedAudioFile(file) {
    const lowerName = (file.name || "").toLowerCase()
    const hasAcceptedExtension = ACCEPTED_EXTENSIONS.some((ext) => lowerName.endsWith(ext))
    const hasAcceptedType = ACCEPTED_TYPES.includes(file.type)
    return hasAcceptedType || hasAcceptedExtension
  }

  function validateFile(file) {
    if (!isAcceptedAudioFile(file)) {
      return "Only MP3 and WAV files are supported."
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return `File "${file.name}" exceeds ${MAX_SIZE_MB}MB.`
    }
    return null
  }

  function collectAcceptedFiles(files) {
    const accepted = []
    const rejected = []

    for (const file of files) {
      const error = validateFile(file)
      if (error) {
        rejected.push(error)
      } else {
        accepted.push(file)
      }
    }

    if (!accepted.length && rejected.length) {
      setStatusMessage(rejected[0])
      return
    }

    if (accepted.length && rejected.length) {
      setStatusMessage(`Added ${accepted.length} file(s). Skipped ${rejected.length}.`)
    } else if (accepted.length) {
      setStatusMessage(`Added ${accepted.length} file(s) to queue.`)
    } else {
      setStatusMessage("No supported audio files found.")
    }

    if (accepted.length) onFilesSelect(accepted)
  }

  function handleFileChange(e) {
    const files = Array.from(e.target.files || [])
    collectAcceptedFiles(files)
    e.target.value = ""
  }

  function handleDrop(e) {
    e.preventDefault()
    setIsDraggingOver(false)
    const files = Array.from(e.dataTransfer.files || [])
    collectAcceptedFiles(files)
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
      fileInputRef.current?.click()
    }
  }

  return (
    <>
      <div
        className={`upload-zone ${isDraggingOver ? "upload-zone--active" : ""}`}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={handleKeyDown}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        role="button"
        tabIndex={0}
        aria-label="Upload an audio file by dragging and dropping or clicking to browse"
      >
        <p>Drop audio files here or click to browse</p>
        <p className="upload-hint">You can add multiple files to build a queue.</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          multiple
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
      </div>

      {statusMessage && (
        <p className="upload-error" role="status" aria-live="polite">
          {statusMessage}
        </p>
      )}
    </>
  )
}

export default FileUpload
