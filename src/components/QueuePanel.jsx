import { useState } from "react"

function QueuePanel({
  queue,
  activeTrackId,
  onPlayTrack,
  onRemoveTrack,
  onReorderById,
  onMoveUp,
  onMoveDown,
  onAddFiles,
}) {
  const [draggingTrackId, setDraggingTrackId] = useState(null)

  if (!queue.length) return null

  return (
    <section className="queue-panel">
      <div className="queue-header">
        <h2>Queue</h2>
        <label className="queue-add-btn">
          + Add to Queue
          <input
            type="file"
            accept="audio/*"
            multiple
            onChange={(e) => {
              const files = Array.from(e.target.files || [])
              if (files.length) onAddFiles(files)
              e.target.value = ""
            }}
            style={{ display: "none" }}
          />
        </label>
      </div>
      <ol className="queue-list">
        {queue.map((track, index) => {
          const isActive = track.id === activeTrackId
          const title = track.metadata?.title?.trim() || track.name
          const subtitle = [track.metadata?.artist, track.metadata?.album]
            .filter(Boolean)
            .join(" — ")

          return (
            <li
              key={track.id}
              className={`queue-item ${isActive ? "queue-item--active" : ""}`}
              draggable
              onDragStart={(e) => {
                setDraggingTrackId(track.id)
                e.dataTransfer.effectAllowed = "move"
                e.dataTransfer.setData("text/plain", track.id)
              }}
              onDragEnd={() => setDraggingTrackId(null)}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = "move"
              }}
              onDrop={(e) => {
                e.preventDefault()
                const sourceId = draggingTrackId || e.dataTransfer.getData("text/plain")
                if (!sourceId || sourceId === track.id) return
                onReorderById(sourceId, track.id)
                setDraggingTrackId(null)
              }}
            >
              <div className="queue-item-main">
                <span className="queue-index">{index + 1}.</span>
                <div className="queue-track-text">
                  <p className="queue-track-title">{title}</p>
                  {subtitle && <p className="queue-track-subtitle">{subtitle}</p>}
                </div>
                {track.status === "loading" && <span className="queue-track-status">Loading…</span>}
                {track.status === "error" && <span className="queue-track-status queue-track-status--error">Metadata error</span>}
              </div>

              <div className="queue-item-actions">
                <button type="button" onClick={() => onPlayTrack(track.id)}>
                  Play
                </button>
                <button
                  type="button"
                  onClick={() => onMoveUp(track.id)}
                  disabled={index === 0}
                  aria-label="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => onMoveDown(track.id)}
                  disabled={index === queue.length - 1}
                  aria-label="Move down"
                >
                  ↓
                </button>
                <button type="button" onClick={() => onRemoveTrack(track.id)}>
                  Remove
                </button>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

export default QueuePanel
