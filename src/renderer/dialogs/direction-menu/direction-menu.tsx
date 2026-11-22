// spec/screens-variants.md, "Direction dialogs": the menu button "Direction" under a direction's
// heading, with "New direction from this master…", "Rename…" and "Delete direction…". Each item
// opens its dialog. With one direction, "Delete direction…" stays focusable but is marked
// disabled, with the hint "A campaign keeps at least one direction." It follows the project
// switcher's keys: arrows move and wrap, Escape closes and puts the focus back on the button,
// Tab or a click elsewhere closes it.
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import type { DirectionControlProps } from '@/renderer/screens/campaign/direction-header'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import { menuPlaceStyles, useMenuPlace } from '@/renderer/ui/menu-place'
import { DeleteDirection } from './delete-direction'
import { NameDialog } from './name-dialog'
import { nextDirectionName } from './next-name'
import styles from './direction-menu.module.css'

type Shown = 'new' | 'rename' | 'delete' | null
type Item = { key: Exclude<Shown, null>; label: string; hint?: string }

export const LAST_DIRECTION_HINT = 'A campaign keeps at least one direction.'

export function DirectionMenu({ projectId, campaign, direction }: DirectionControlProps) {
  const [open, setOpen] = useState(false)
  const [shown, setShown] = useState<Shown>(null)
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLUListElement>(null)
  const ids = useId()
  const place = useMenuPlace(open, button, menu)
  const only = campaign.directions.length <= 1
  const items: Item[] = [
    { key: 'new', label: 'New direction from this master…' },
    { key: 'rename', label: 'Rename…' },
    { key: 'delete', label: 'Delete direction…', ...(only && { hint: LAST_DIRECTION_HINT }) },
  ]
  const variantCount = campaign.variants.filter((v) => v.directionId === direction.id).length

  const menuItems = () => [...(menu.current?.querySelectorAll('button') ?? [])]

  useEffect(() => {
    if (!open) return
    menuItems()[0]?.focus()
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

  function onKeyDown(event: KeyboardEvent) {
    const all = menuItems()
    const at = all.findIndex((el) => el === document.activeElement)
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key]
    if (step !== undefined) {
      event.preventDefault()
      all[(at + step + all.length) % all.length]?.focus()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      close()
    } else if (event.key === 'Tab') {
      setOpen(false)
    }
  }

  const shut = () => setShown(null)
  return (
    <div className={menuPlaceStyles.holder}>
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${ids}-menu` : undefined}
        onClick={() => setOpen(!open)}
      >
        Direction
        <Icon name="down" size="small" />
      </button>
      {open && (
        <ul
          ref={menu}
          id={`${ids}-menu`}
          role="menu"
          aria-label={`Direction ${direction.name}`}
          className={`${layout.menu} ${menuPlaceStyles.placed}`}
          onKeyDown={onKeyDown}
          {...place}
        >
          {items.map((item) => (
            <li key={item.key} role="none">
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                className={`${layout.menuItem} ${styles.item}`}
                aria-disabled={item.hint !== undefined || undefined}
                aria-describedby={item.hint === undefined ? undefined : `${ids}-hint`}
                onClick={() => {
                  if (item.hint !== undefined) return
                  close()
                  setShown(item.key)
                }}
              >
                {item.label}
              </button>
              {item.hint !== undefined && (
                <p id={`${ids}-hint`} className={layout.menuLabel}>
                  {item.hint}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      <NameDialog
        open={shown === 'new'}
        title="New direction"
        action="Make direction"
        initialName={nextDirectionName(campaign.directions.map((d) => d.name))}
        command="direction.createFromMaster"
        input={(name) => ({ projectId, masterVariantId: direction.masterVariantId, name })}
        onClose={shut}
      />
      <NameDialog
        open={shown === 'rename'}
        title={`Rename ${direction.name}`}
        action="Rename"
        initialName={direction.name}
        command="direction.rename"
        input={(name) => ({ projectId, directionId: direction.id, name })}
        onClose={shut}
      />
      <DeleteDirection
        open={shown === 'delete'}
        projectId={projectId}
        direction={direction}
        variantCount={variantCount}
        onClose={shut}
      />
    </div>
  )
}
