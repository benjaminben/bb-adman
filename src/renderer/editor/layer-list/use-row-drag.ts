// spec/editor.md, "Layer list", Reorder: drag a row; a line shows where it will land; dropping
// sends one layer.reorder. The dragged row is kept here, not in the drag data, so a drop from
// outside the list does nothing. The background row takes drops but is never dragged.
import { useState, type DragEvent } from 'react'
import type { DropAt, RowDrag } from '@/renderer/editor/layer-row'
import { dropped } from './stack-order'

function half(event: DragEvent<HTMLElement>): DropAt {
  const box = event.currentTarget.getBoundingClientRect()
  return event.clientY < box.top + box.height / 2 ? 'above' : 'below'
}

export function useRowDrag(order: string[], onReorder: (ids: string[] | null) => void) {
  const [dragging, setDragging] = useState<string | null>(null)
  const [over, setOver] = useState<{ id: string; at: DropAt } | null>(null)

  const stop = () => {
    setDragging(null)
    setOver(null)
  }

  return (id: string, isBackground: boolean): RowDrag => ({
    draggable: !isBackground,
    dropAt: dragging && over?.id === id ? over.at : null,
    onDragStart(event) {
      if (isBackground) return
      event.dataTransfer?.setData('text/plain', id)
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
      setDragging(id)
    },
    onDragOver(event) {
      if (!dragging) return
      event.preventDefault()
      const at = half(event)
      if (over?.id !== id || over.at !== at) setOver({ id, at })
    },
    onDragLeave() {
      if (over?.id === id) setOver(null)
    },
    onDrop(event) {
      if (!dragging) return
      event.preventDefault()
      onReorder(dropped(order, dragging, id, half(event) === 'above'))
      stop()
    },
    onDragEnd: stop,
  })
}
