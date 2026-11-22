// InfoTip is for plain help only. Money, lost work, data leaving the machine, what an agent asks
// to do, and failures never go in an InfoTip: they stay on the page, in words, beside the action
// (spec/phases/design-wave.md, "Security text stays on the page").
//
// A small info button that opens a popover of one to three sentences (T3b,
// spec/app-style-parts.md "InfoTip"). It opens on a click, Enter or Space, and while the pointer
// rests on the button or the popover. Escape, a click outside or a second click closes it, and
// focus stays on or returns to the button. One InfoTip is open at a time. Not modal; the
// popover holds no control.
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import { menuPlaceStyles, useMenuPlace } from '@/renderer/ui/menu-place'
import styles from './info-tip.module.css'

export type InfoTipProps = { about: string; children: ReactNode }

// Opened by the pointer resting on it, or pinned open by a click or a key.
type Mode = 'closed' | 'hover' | 'pinned'

// The one open InfoTip's way to close itself.
let closeOpen: (() => void) | null = null

export function InfoTip(props: InfoTipProps) {
  const [mode, setMode] = useState<Mode>('closed')
  const open = mode !== 'closed'
  const holder = useRef<HTMLSpanElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const pop = useRef<HTMLSpanElement>(null)
  const place = useMenuPlace(open, button, pop)
  const popId = useId()
  const name = `About ${props.about}`

  useEffect(() => {
    if (!open) return
    const close = () => setMode('closed')
    if (closeOpen !== close) closeOpen?.()
    closeOpen = close
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      close()
      button.current?.focus()
    }
    function onPointer(event: PointerEvent) {
      if (!holder.current?.contains(event.target as Node)) close()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      if (closeOpen === close) closeOpen = null
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open])

  return (
    <span
      ref={holder}
      className={`${menuPlaceStyles.holder} ${styles.holder}`}
      onPointerEnter={() => setMode((m) => (m === 'closed' ? 'hover' : m))}
      onPointerLeave={() => setMode((m) => (m === 'hover' ? 'closed' : m))}
    >
      <button
        ref={button}
        type="button"
        className={`${layout.quiet} ${layout.small} ${layout.iconOnly} ${styles.button}`}
        aria-label={name}
        title={name}
        aria-expanded={open}
        aria-controls={popId}
        onClick={() => setMode((m) => (m === 'pinned' ? 'closed' : 'pinned'))}
      >
        <Icon name="info" />
      </button>
      <span
        ref={pop}
        id={popId}
        className={`${menuPlaceStyles.placed} ${styles.pop}`}
        hidden={!open}
        {...place}
      >
        <span className={styles.words}>{props.children}</span>
      </span>
    </span>
  )
}
