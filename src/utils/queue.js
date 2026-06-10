export function moveQueueItem(items, fromIndex, toIndex) {
  if (!Array.isArray(items)) return []
  if (fromIndex === toIndex) return [...items]
  if (fromIndex < 0 || fromIndex >= items.length) return [...items]
  if (toIndex < 0 || toIndex >= items.length) return [...items]

  const next = [...items]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next
}

export function getTrackIndex(queue, trackId) {
  return queue.findIndex((track) => track.id === trackId)
}

export function getNextTrackId(queue, activeTrackId) {
  if (!queue.length) return null
  const activeIndex = getTrackIndex(queue, activeTrackId)
  if (activeIndex === -1) return queue[0].id
  const next = queue[activeIndex + 1]
  return next ? next.id : null
}

export function getPreviousTrackId(queue, activeTrackId) {
  if (!queue.length) return null
  const activeIndex = getTrackIndex(queue, activeTrackId)
  if (activeIndex <= 0) return null
  return queue[activeIndex - 1].id
}
