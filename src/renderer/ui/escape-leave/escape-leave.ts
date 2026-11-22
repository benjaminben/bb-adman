// Escape anywhere in the window leaves a page (SH-2 for Settings, choice C-14; HOME-2 for the
// New campaign page), unless something else takes it first. Taken means: a dialog, a menu or a
// placed popover (an InfoTip, a swatch picker) was open when the key went down, a part stopped
// the key or marked it handled (a SubPage, the activity panel, the project menu), or the key was
// pressed in a key field holding a typed key, which leaving would drop. The open state is read
// before any part closes itself, in the capture phase; the leave happens after every part had
// its turn. By default the focused field is blurred first, so a field that saves on leaving
// (SET-6) saves, as a click elsewhere would; `blur: false` keeps the focus where it is, so a
// question asked before leaving can hand it back.
import { useEffect } from 'react'
import { menuPlaceStyles } from '@/renderer/ui/menu-place'

const OPEN = `[role="dialog"], [role="alertdialog"], [role="menu"], .${menuPlaceStyles.placed}:not([hidden])`

const typedKey = (target: EventTarget | null) =>
  target instanceof HTMLInputElement && target.type === 'password' && target.value !== ''

export type EscapeLeaveOptions = { blur?: boolean }

export function useEscapeLeave(
  onLeave: (() => void) | undefined,
  options: EscapeLeaveOptions = {},
): void {
  const blur = options.blur ?? true
  useEffect(() => {
    if (onLeave === undefined) return
    let taken = false
    const before = (event: KeyboardEvent) => {
      if (event.key === 'Escape')
        taken = document.querySelector(OPEN) !== null || typedKey(event.target)
    }
    const after = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || taken || event.defaultPrevented) return
      if (blur && document.activeElement instanceof HTMLElement) document.activeElement.blur()
      onLeave()
    }
    window.addEventListener('keydown', before, true)
    window.addEventListener('keydown', after)
    return () => {
      window.removeEventListener('keydown', before, true)
      window.removeEventListener('keydown', after)
    }
  }, [onLeave, blur])
}
