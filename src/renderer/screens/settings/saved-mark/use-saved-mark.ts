// The one-value save rule (SET-6, choice C-4): a field saves on Enter or when focus leaves it,
// sends its command once, and shows "Saved" for 2 seconds after a save that changed something.
// The field turns its text into the value to save (trimmed, parsed); this hook only decides
// whether to send it and keeps the typed text until the saved value catches up.
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

export const SAVED_MS = 2000

export function useSavedMark() {
  const [shown, setShown] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current)
    },
    [],
  )
  function show() {
    if (timer.current !== null) clearTimeout(timer.current)
    setShown(true)
    timer.current = setTimeout(() => setShown(false), SAVED_MS)
  }
  return { shown, show }
}

// `send` returns true when the command was accepted. Nothing is sent for a value equal to the
// saved one, for the value last sent if nothing was typed since (saved but not yet read back, or
// refused: Enter then leaving sends once), or while a save is on its way.
export function useSingleSave(saved: string, send: (value: string) => Promise<boolean>) {
  const mark = useSavedMark()
  const [typed, setTyped] = useState<{ over: string; text: string } | null>(null)
  const tried = useRef<{ over: string; value: string } | null>(null)
  const busy = useRef(false)
  const text = typed !== null && typed.over === saved ? typed.text : saved

  async function save(value: string) {
    const last = tried.current
    if (busy.current || value === saved || (last?.over === saved && last.value === value)) return
    busy.current = true
    tried.current = { over: saved, value }
    try {
      if (await send(value)) mark.show()
    } finally {
      busy.current = false
    }
  }

  return {
    text,
    saved: mark.shown,
    type: (next: string) => {
      tried.current = null
      setTyped({ over: saved, text: next })
    },
    reset: () => setTyped(null),
    save,
  }
}

// Enter saves like leaving does; it does not submit a form around the field.
export function onEnter(save: () => void) {
  return (event: KeyboardEvent) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    save()
  }
}
