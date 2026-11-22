// spec/editor.md, "The shell" [FR-003], tidied by SH-3: a menu button showing the shown
// project's name, or "AdManager" on the start screen, then with two or more open a count chip
// "{n}" (hidden words " projects open"). Its menu holds a row per open project (choosing it
// shows the project; its ✕ "Close {name}" closes that project through close-project.tsx, which
// asks first with runs going), a separator, then "Package…" (shown project only), "Open…" and
// "Start screen". Arrow keys move through every item and wrap; Escape or a click elsewhere
// closes it.
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { EMPTY, useApp } from '@/renderer/app/app-context'
import type { View } from '@/renderer/stores/app-store'
import { usePackageProject } from '@/renderer/screens/project-home/package-project'
import { Icon } from '@/renderer/ui/icon'
import { APP_DISPLAY_NAME } from '@/shared/config/app-name'
import layout from '@/renderer/ui/layout.module.css'
import { menuPlaceStyles, useMenuPlace } from '@/renderer/ui/menu-place'
import { useCloseProject } from './close-project'
import { useOpenAnother } from './open-another'
import { ProjectRows } from './project-rows'
import { useShownRunning } from './use-shown-running'
import styles from './project-switcher.module.css'

type Item = { key: string; label: string; act: () => void }

export function ProjectSwitcher() {
  const projects = useApp((s) => s.app?.openProjects ?? EMPTY)
  const view = useApp((s) => s.view)
  const show = useApp((s) => s.show)
  const { closeProject, dialog } = useCloseProject()
  const openAnother = useOpenAnother()
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLUListElement>(null)
  const menuId = useId()
  const place = useMenuPlace(open, button, menu)
  const shownId = view.kind === 'project' ? view.projectId : null
  const shown = projects.find((p) => p.projectId === shownId)
  const running = useShownRunning(shownId)
  const pack = usePackageProject(shown ? shown.projectId : null)
  const count = projects.length

  const go = (next: View) => () => show(next)
  const items: Item[] = [
    ...(shown ? [{ key: 'package', label: 'Package…', act: pack.open }] : []),
    { key: 'open', label: 'Open…', act: () => void openAnother() },
    { key: 'start', label: 'Start screen', act: go({ kind: 'start' }) },
  ]

  const menuItems = () => [
    ...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []),
  ]

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

  const choose = (act: () => void) => () => {
    close()
    act()
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

  return (
    <div className={styles.switcher}>
      <button
        ref={button}
        type="button"
        className={styles.button}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        title={count > 1 ? `${count} projects open` : undefined}
        onClick={() => setOpen(!open)}
      >
        <span className={styles.name}>
          <span className={styles.title}>{shown?.name ?? APP_DISPLAY_NAME}</span>
          {count > 1 && (
            <>
              {' '}
              <span className={`${layout.chip} ${styles.count}`}>
                {count} <span className={styles.hidden}>projects open</span>
              </span>
            </>
          )}
        </span>
        <span className={styles.caret}>
          <Icon name="down" size="small" />
        </span>
      </button>
      {open && (
        <ul
          ref={menu}
          id={menuId}
          role="menu"
          className={`${layout.menu} ${menuPlaceStyles.placed} ${styles.menu}`}
          onKeyDown={onKeyDown}
          {...place}
        >
          <ProjectRows
            projects={projects}
            shownId={shownId}
            running={running}
            onShow={(projectId) => choose(go({ kind: 'project', projectId }))()}
            onClose={(projectId, name) => choose(() => void closeProject(projectId, name))()}
          />
          <li role="separator" className={styles.separator} />
          {items.map((item) => (
            <li key={item.key} role="none">
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                className={`${layout.menuItem} ${styles.item}`}
                onClick={choose(item.act)}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {dialog}
      {pack.dialog}
    </div>
  )
}
