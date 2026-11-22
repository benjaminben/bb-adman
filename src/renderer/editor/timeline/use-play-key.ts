// P7-18 (spec/phases/phase-07-slices-2.md): Space plays or pauses while the focus is on the
// timeline or the canvas, never in a text field (useEditorKey leaves fields alone). Elsewhere
// in the editor the shortcut is switched off, so Space on a button there is not prevented and
// presses that button as usual.
import { useEffect, useState } from 'react'
import { useEditorKey } from '@/renderer/editor/use-editor-key'

const PLAY_AREAS = '[data-timeline], [data-canvas]'

function focusInPlayArea(): boolean {
  const focused = document.activeElement
  return focused instanceof Element && focused.closest(PLAY_AREAS) !== null
}

export function usePlayKey(toggle: () => void): void {
  const [active, setActive] = useState(focusInPlayArea)
  useEffect(() => {
    const update = () => setActive(focusInPlayArea())
    document.addEventListener('focusin', update)
    document.addEventListener('focusout', update)
    return () => {
      document.removeEventListener('focusin', update)
      document.removeEventListener('focusout', update)
    }
  }, [])
  useEditorKey('playPause', toggle, active)
}
