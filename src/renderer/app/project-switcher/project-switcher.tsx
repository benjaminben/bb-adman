// spec/editor.md, "The shell" [FR-003]: a menu button showing the shown project's name, or
// "Adman" on the start screen. Its menu lists the open projects (choosing one shows it), then
// "Start", then "Close project" for the shown one (project.close; with runs going it asks
// first, close-project.tsx). Arrow keys move through the items and wrap; Escape or a click
// elsewhere closes it.
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { EMPTY, useApp } from '@/renderer/app/app-context'
import type { View } from '@/renderer/stores/app-store'
import { useCloseProject } from './close-project'
import styles from './project-switcher.module.css'

type Item = { key: string; label: string; act: () => void }

export function ProjectSwitcher() {
  const projects = useApp((s) => s.app?.openProjects ?? EMPTY)
  const view = useApp((s) => s.view)
  const show = useApp((s) => s.show)
  const { closeProject, dialog } = useCloseProject()
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLUListElement>(null)
  const menuId = useId()
  const shownId = view.kind === 'project' ? view.projectId : null
  const shown = projects.find((p) => p.projectId === shownId)

  const go = (next: View) => () => show(next)
  const items: Item[] = [
    ...projects.map((p) => ({
      key: p.projectId,
      label: p.name,
      act: go({ kind: 'project', projectId: p.projectId }),
    })),
    { key: 'start', label: 'Start', act: go({ kind: 'start' }) },
  ]
  if (shownId !== null) {
    const projectId = shownId
    const close = () => void closeProject(projectId, shown?.name ?? 'this project')
    items.push({ key: 'close', label: 'Close project', act: close })
  }

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

  return (
    <div className={styles.switcher}>
      <button
        ref={button}
        type="button"
        className={styles.button}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen(!open)}
      >
        {shown?.name ?? 'Adman'}
      </button>
      {open && (
        <ul ref={menu} id={menuId} role="menu" className={styles.menu} onKeyDown={onKeyDown}>
          {items.map((item) => (
            <li key={item.key} role="none">
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                className={item.key === 'start' ? styles.after : styles.item}
                aria-current={item.key === shownId || undefined}
                onClick={() => {
                  close()
                  item.act()
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {dialog}
    </div>
  )
}
