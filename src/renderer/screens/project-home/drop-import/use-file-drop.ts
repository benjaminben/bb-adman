// Window drag listeners for the drop target (spec/screens-campaign.md, "Importing by dropping
// files"). Only a drag holding files is taken; any other drag is left alone. `dragging` is
// true while files are over the window; `onFiles` gets each drop's file list.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export type FileDropOptions = { ignore: boolean; onFiles: (files: FileList) => void }

function holdsFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files')
}

export function useFileDrop(options: FileDropOptions): boolean {
  const [dragging, setDragging] = useState(false)
  const latest = useRef(options)
  useLayoutEffect(() => {
    latest.current = options
  })

  useEffect(() => {
    // dragenter and dragleave fire for each element crossed; the count is 0 once the drag
    // has left the window.
    let depth = 0
    const hide = () => {
      depth = 0
      setDragging(false)
    }
    const enter = (event: DragEvent) => {
      if (!holdsFiles(event)) return
      depth += 1
      if (!latest.current.ignore) setDragging(true)
    }
    const over = (event: DragEvent) => {
      if (!holdsFiles(event) || !event.dataTransfer) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
    }
    const leave = (event: DragEvent) => {
      if (!holdsFiles(event)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragging(false)
    }
    const drop = (event: DragEvent) => {
      if (!holdsFiles(event) || !event.dataTransfer) return
      event.preventDefault()
      hide()
      if (!latest.current.ignore) latest.current.onFiles(event.dataTransfer.files)
    }
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hide()
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragover', over)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragover', over)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', drop)
      window.removeEventListener('keydown', key)
    }
  }, [])

  return dragging
}
