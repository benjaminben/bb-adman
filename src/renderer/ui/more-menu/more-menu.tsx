// MoreMenu (spec/app-style-parts.md, "ObjectRow", T3c): the ⋯ icon button at a row's end and
// its menu. Items keep the given order, except that danger items go last, after a separator.
// The menu stays in the window (ui/menu-place). Arrow keys move and wrap, Escape closes and
// gives focus back to the button, Tab or a click elsewhere closes it. An item fires only on its
// own click (or Enter or Space on it), never on opening or on hover. A disabled item stays
// focusable, gives its reason in `title` and does nothing.
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Icon, type IconName } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import { menuPlaceStyles, useMenuPlace } from '@/renderer/ui/menu-place'
import styles from './more-menu.module.css'

export type MoreItem = {
  id: string
  label: string
  icon?: IconName
  danger?: boolean
  disabled?: boolean
  reason?: string
  onChoose: () => void
}

export type MoreMenuProps = { label: string; items: MoreItem[] }

function MenuEntry(props: { item: MoreItem; onChoose: (item: MoreItem) => void }) {
  const { item } = props
  const kind = item.danger ? `${styles.item} ${styles.danger}` : styles.item
  return (
    <li role="none">
      <button
        type="button"
        role="menuitem"
        tabIndex={-1}
        className={`${layout.menuItem} ${kind}`}
        aria-disabled={item.disabled || undefined}
        title={item.disabled ? item.reason : undefined}
        onClick={() => props.onChoose(item)}
      >
        {item.icon !== undefined && <Icon name={item.icon} size="small" />}
        {item.label}
      </button>
    </li>
  )
}

export function MoreMenu(props: MoreMenuProps) {
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLUListElement>(null)
  const id = useId()
  const place = useMenuPlace(open, button, menu)
  const name = `More actions for ${props.label}`
  const plain = props.items.filter((item) => !item.danger)
  const danger = props.items.filter((item) => item.danger)

  const entries = () => [...(menu.current?.querySelectorAll('button') ?? [])]

  useEffect(() => {
    if (!open) return
    entries()[0]?.focus()
    const onDown = (event: MouseEvent) => {
      const inside = [menu.current, button.current].some(
        (el) => event.target instanceof Node && el?.contains(event.target),
      )
      if (!inside) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function close() {
    setOpen(false)
    button.current?.focus()
  }

  function choose(item: MoreItem) {
    if (item.disabled) return
    close()
    item.onChoose()
  }

  function onKeyDown(event: KeyboardEvent) {
    const all = entries()
    const at = all.findIndex((el) => el === document.activeElement)
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key]
    const jump = { Home: 0, End: all.length - 1 }[event.key]
    // A held key that opened the menu must not go on to fire the first item.
    if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault()
    else if (step !== undefined || jump !== undefined) {
      event.preventDefault()
      all[jump ?? (at + (step ?? 0) + all.length) % all.length]?.focus()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close()
    } else if (event.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div className={menuPlaceStyles.holder}>
      <button
        ref={button}
        type="button"
        className={styles.trigger}
        aria-label={name}
        title={name}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        onClick={() => setOpen(!open)}
      >
        <Icon name="more" size="small" />
      </button>
      {open && (
        <ul
          ref={menu}
          id={`${id}-menu`}
          role="menu"
          aria-label={name}
          className={`${layout.menu} ${menuPlaceStyles.placed} ${styles.menu}`}
          onKeyDown={onKeyDown}
          {...place}
        >
          {plain.map((item) => (
            <MenuEntry key={item.id} item={item} onChoose={choose} />
          ))}
          {plain.length > 0 && danger.length > 0 && (
            <li role="separator" className={styles.separator} />
          )}
          {danger.map((item) => (
            <MenuEntry key={item.id} item={item} onChoose={choose} />
          ))}
        </ul>
      )}
    </div>
  )
}
