import { useEffect, useRef, useState } from "react"
const EMPTY_DRAG_IMAGE =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="
function QueuePanel({
  queue,
  activeTrackId,
  onPlayTrack,
  onRemoveTrack,
  onReorderToIndex,
  onMoveUp,
  onMoveDown,
  onAddFiles,
  onClearQueue,
  onKeepCurrentOnly,
}) {
  const [draggingTrackId, setDraggingTrackId] = useState(null)
  const [hoverInsertIndex, setHoverInsertIndex] = useState(null)
  const [dragPreview, setDragPreview] = useState(null)
  const [dragItemOffset, setDragItemOffset] = useState(0)
  const queueListRef = useRef(null)
  const emptyDragImageRef = useRef(null)
  const dragMotionRef = useRef({
    lastX: 0,
    lastY: 0,
    lastTs: 0,
    vx: 0,
    vy: 0,
  })
  useEffect(() => {
    const img = new Image()
    img.src = EMPTY_DRAG_IMAGE
    emptyDragImageRef.current = img
  }, [])
  if (!queue.length) return null
  const draggingSourceIndex =
    draggingTrackId == null ? -1 : queue.findIndex((track) => track.id === draggingTrackId)
  function computeInsertIndexFromCursor(clientY) {
    if (!queueListRef.current) return queue.length
    const itemElements = Array.from(queueListRef.current.querySelectorAll(".queue-item"))
    let insertIndex = queue.length
    for (const element of itemElements) {
      const itemIndex = Number(element.dataset.index)
      if (Number.isNaN(itemIndex) || itemIndex === draggingSourceIndex) continue
      const rect = element.getBoundingClientRect()
      const midpoint = rect.top + rect.height / 2
      if (clientY < midpoint) {
        insertIndex = itemIndex
        break
      }
      insertIndex = Math.max(insertIndex, itemIndex + 1)
    }
    return insertIndex
  }
  function handleDropOnList(e) {
    e.preventDefault()
    const sourceId = draggingTrackId || e.dataTransfer.getData("text/plain")
    if (!sourceId) return
    const insertIndex = hoverInsertIndex == null ? queue.length : hoverInsertIndex
    onReorderToIndex(sourceId, insertIndex)
    setDraggingTrackId(null)
    setHoverInsertIndex(null)
    setDragPreview(null)
    setDragItemOffset(0)
  }
  return (
    <section className="queue-panel" aria-label="Playback queue">
      <div className="queue-header">
        <h2>Queue ({queue.length})</h2>
        <div className="queue-header-actions">
          <button
            type="button"
            className="queue-action-btn"
            onClick={onKeepCurrentOnly}
            disabled={!activeTrackId || queue.length <= 1}
            title="Keep only the currently playing song"
            aria-label="Keep only currently playing song in queue"
          >
            Keep Current Only
          </button>
          <button
            type="button"
            className="queue-action-btn queue-action-btn--danger"
            onClick={onClearQueue}
            disabled={queue.length === 0}
            title="Clear all songs from queue"
            aria-label="Clear all songs from queue"
          >
            Clear Queue
          </button>
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
      </div>
      <ol
        ref={queueListRef}
        className="queue-list"
        onDragOver={(e) => {
          e.preventDefault()
          if (draggingSourceIndex === -1) return
          e.dataTransfer.dropEffect = "move"
          setHoverInsertIndex(computeInsertIndexFromCursor(e.clientY))
        }}
        onDrop={handleDropOnList}
      >
        {queue.map((track, index) => {
          const isActive = track.id === activeTrackId
          const isDraggingSource = track.id === draggingTrackId
          const title = track.metadata?.title?.trim() || track.name
          const subtitle = [track.metadata?.artist, track.metadata?.album]
            .filter(Boolean)
            .join(" — ")
          let shiftY = 0
          if (
            draggingSourceIndex !== -1 &&
            hoverInsertIndex != null &&
            index !== draggingSourceIndex &&
            dragItemOffset > 0
          ) {
            if (draggingSourceIndex < hoverInsertIndex) {
              if (index > draggingSourceIndex && index < hoverInsertIndex) shiftY = -dragItemOffset
            } else if (draggingSourceIndex > hoverInsertIndex) {
              if (index >= hoverInsertIndex && index < draggingSourceIndex) shiftY = dragItemOffset
            }
          }
          return (
            <li
              key={track.id}
              data-index={index}
              className={`queue-item ${isActive ? "queue-item--active" : ""} ${
                isDraggingSource ? "queue-item--dragging-source" : ""
              }`}
              style={shiftY !== 0 ? { transform: `translateY(${shiftY}px)` } : undefined}
              draggable
              onDragStart={(e) => {
                setDraggingTrackId(track.id)
                setDragItemOffset(e.currentTarget.getBoundingClientRect().height + 8)
                setDragPreview({
                  title,
                  subtitle,
                  x: e.clientX,
                  y: e.clientY,
                  rotate: 0,
                })
                if (emptyDragImageRef.current) {
                  e.dataTransfer.setDragImage(emptyDragImageRef.current, 0, 0)
                }
                e.dataTransfer.effectAllowed = "move"
                e.dataTransfer.setData("text/plain", track.id)
              }}
              onDrag={(e) => {
                if (e.clientX === 0 && e.clientY === 0) return
                const now = performance.now()
                const motion = dragMotionRef.current
                if (!motion.lastTs) {
                  motion.lastX = e.clientX
                  motion.lastY = e.clientY
                  motion.lastTs = now
                }
                const dt = Math.max(1, now - motion.lastTs)
                const dx = e.clientX - motion.lastX
                const dy = e.clientY - motion.lastY
                const rawVx = dx / dt
                const rawVy = dy / dt
                motion.vx = motion.vx * 0.75 + rawVx * 0.25
                motion.vy = motion.vy * 0.75 + rawVy * 0.25
                motion.lastX = e.clientX
                motion.lastY = e.clientY
                motion.lastTs = now
                const rotate = Math.max(-7, Math.min(7, motion.vx * 28 + motion.vy * 6))
                setDragPreview((prev) =>
                  prev
                    ? {
                        ...prev,
                        x: e.clientX,
                        y: e.clientY,
                        rotate,
                      }
                    : prev
                )
              }}
              onDragEnd={() => {
                setDraggingTrackId(null)
                setHoverInsertIndex(null)
                setDragPreview(null)
                setDragItemOffset(0)
                dragMotionRef.current = {
                  lastX: 0,
                  lastY: 0,
                  lastTs: 0,
                  vx: 0,
                  vy: 0,
                }
              }}
            >
              <div className="queue-item-main">
                <span className="queue-index">{index + 1}.</span>
                <div className="queue-track-text">
                  {isActive && <p className="queue-now-playing-tag">Now Playing</p>}
                  <p className="queue-track-title">{title}</p>
                  {subtitle && <p className="queue-track-subtitle">{subtitle}</p>}
                </div>
                {track.status === "loading" && <span className="queue-track-status">Loading…</span>}
                {track.status === "error" && (
                  <span className="queue-track-status queue-track-status--error">Metadata error</span>
                )}
              </div>
              <div className="queue-item-actions">
                <button type="button" onClick={() => onPlayTrack(track.id)} aria-label={`Play ${title}`}>
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
                <button
                  type="button"
                  onClick={() => onRemoveTrack(track.id)}
                  aria-label={`Remove ${title} from queue`}
                >
                  Remove
                </button>
              </div>
            </li>
          )
        })}
      </ol>
      {dragPreview && (
        <div
          className="queue-drag-floating"
          style={{
            transform: `translate(${dragPreview.x + 14}px, ${dragPreview.y + 14}px) rotate(${dragPreview.rotate || 0}deg)`,
          }}
          aria-hidden="true"
        >
          <p className="queue-drag-title">{dragPreview.title}</p>
          {dragPreview.subtitle && <p className="queue-drag-subtitle">{dragPreview.subtitle}</p>}
        </div>
      )}
    </section>
  )
}
export default QueuePanel
