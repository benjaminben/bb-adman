// New project in place (START-2, FR-004): "New project" swaps the two start buttons for one row,
// a name field, a folder button and Create. The folder starts as the default from Settings and
// shows only in the folder button's name and tooltip, never printed (spec/security.md, "Paths in
// the renderer"). The screen's other button (Open…) comes in as children and sits beside New
// project. Create, or Enter in the field, sends project.create once; an empty name sends
// nothing. A refusal stays under the row as words, the typed name kept. Escape, or leaving the
// row for another control with the field empty, brings the two buttons back.
import { useEffect, useRef, useState, type FocusEvent, type FormEvent, type ReactNode } from 'react'
import { useApi, useApp, pickPath } from '@/renderer/app/app-context'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import styles from './new-project-form.module.css'

export function NewProjectForm(props: { children?: ReactNode }) {
  const api = useApi()
  const command = useApp((s) => s.command)
  const clearError = useApp((s) => s.clearError)
  const defaultDir = useApp((s) => s.app?.settings.defaultProjectDir ?? '')
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [location, setLocation] = useState<string | null>(null)
  const [refusal, setRefusal] = useState<string | null>(null)
  const sending = useRef(false)
  const backToButton = useRef(false)
  const newButton = useRef<HTMLButtonElement>(null)
  const field = useRef<HTMLInputElement>(null)
  const where = location ?? defaultDir
  const folderName = `Location: ${where}. Change`

  useEffect(() => {
    if (open || !backToButton.current) return
    backToButton.current = false
    newButton.current?.focus()
  }, [open])

  function close(focusButton: boolean) {
    backToButton.current = focusButton
    setRefusal(null)
    setOpen(false)
  }

  async function changeLocation() {
    const picked = await pickPath(api, 'dialog.pickFolder', where)
    if (picked) setLocation(picked)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (sending.current) return
    if (name.trim() === '') {
      field.current?.focus()
      return
    }
    sending.current = true
    setRefusal(null)
    const result = await command('project.create', { name, location: where })
    sending.current = false
    if (result.ok) {
      setName('')
      setOpen(false)
      return
    }
    // The words show here, under the row, so the bar's alert does not repeat them.
    clearError()
    setRefusal(result.error.message)
  }

  // Focus moving to a control outside the row; a native picker takes focus to nothing.
  function onBlur(event: FocusEvent<HTMLFormElement>) {
    const to = event.relatedTarget
    if (name === '' && to instanceof Node && !event.currentTarget.contains(to)) close(false)
  }

  if (!open) {
    return (
      <div className={`${layout.row} ${styles.actions}`}>
        <button
          ref={newButton}
          type="button"
          className={`${layout.primary} ${layout.large}`}
          onClick={() => setOpen(true)}
        >
          <Icon name="plus" />
          New project
        </button>
        {props.children}
      </div>
    )
  }

  return (
    <form
      className={styles.form}
      onSubmit={(e) => void submit(e)}
      onBlur={onBlur}
      onKeyDown={(e) => {
        if (e.key === 'Escape') close(true)
      }}
    >
      <div className={styles.row}>
        <input
          ref={field}
          className={styles.name}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Project name"
          aria-label="Project name"
          autoComplete="off"
          autoFocus
        />
        <button
          type="button"
          className={`${layout.iconButton} ${styles.folder}`}
          aria-label={folderName}
          title={folderName}
          onClick={() => void changeLocation()}
        >
          <Icon name="folder" />
        </button>
        <button type="submit" className={`${layout.primary} ${layout.large}`}>
          Create
        </button>
      </div>
      {refusal && (
        <p role="alert" className={`${layout.danger} ${styles.refusal}`}>
          {refusal}
        </p>
      )}
    </form>
  )
}
