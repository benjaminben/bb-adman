// spec/editor.md, "Keyboard shortcuts": a component registers a handler for a named shortcut;
// no component reads key codes itself. A shortcut works while the focus is inside the editor,
// and, unless its inFields flag says so, not inside a text field, number field, select or text
// area. A key press a component already handled (preventDefault) is left alone, so the layer
// list's arrows do not also nudge. Every handled shortcut is preventDefault-ed, so the app
// menu's Edit roles do not also act.
import { createContext, useContext, useEffect, useRef, type RefObject } from 'react'
import { SHORTCUTS, matchShortcut, type Platform, type ShortcutName } from '@/renderer/ui/shortcuts'

export const platform: Platform = /Mac/i.test(navigator.platform) ? 'mac' : 'windows'

// The editor's root element; given by the editor to everything inside it.
export const EditorKeyRoot = createContext<RefObject<HTMLElement | null> | null>(null)

const FIELDS = 'input, textarea, select, [contenteditable="true"]'

function inField(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(FIELDS) !== null
}

export function useEditorKey(name: ShortcutName, handler: () => void, enabled = true): void {
  const root = useContext(EditorKeyRoot)
  const latest = useRef(handler)
  useEffect(() => {
    latest.current = handler
  }, [handler])
  useEffect(() => {
    if (!root || !enabled) return
    // On the document, so it runs after React's own handlers inside the editor.
    const onKey = (event: KeyboardEvent) => {
      const editor = root.current
      if (event.defaultPrevented || !editor || !(event.target instanceof Node)) return
      if (!editor.contains(event.target)) return
      if (!SHORTCUTS[name].inFields && inField(event.target)) return
      if (!matchShortcut(event, name, platform)) return
      event.preventDefault()
      latest.current()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [root, name, enabled])
}
