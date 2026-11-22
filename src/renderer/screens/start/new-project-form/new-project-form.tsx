// New project: a name, and a location that starts as the default from Settings (FR-004). On
// the start screen's right half (design/audit/spec-start.md) it has no card; the screen's
// other button (Open project…) comes in as children and sits beside Create project.
import { useState, type FormEvent, type ReactNode } from 'react'
import { useApi, useApp, pickPath } from '@/renderer/app/app-context'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import styles from './new-project-form.module.css'

export function NewProjectForm(props: { children?: ReactNode }) {
  const api = useApi()
  const command = useApp((s) => s.command)
  const defaultDir = useApp((s) => s.app?.settings.defaultProjectDir ?? '')
  const [name, setName] = useState('')
  const [location, setLocation] = useState<string | null>(null)
  const where = location ?? defaultDir

  async function changeLocation() {
    const picked = await pickPath(api, 'dialog.pickFolder', where)
    if (picked) setLocation(picked)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const result = await command('project.create', { name, location: where })
    if (result.ok) setName('')
  }

  return (
    <form className={styles.form} onSubmit={(e) => void submit(e)}>
      <div className={layout.field}>
        <label htmlFor="new-project-name">Project name</label>
        <input
          id="new-project-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
          required
        />
      </div>
      <div className={styles.location}>
        <p id="new-project-location-label" className={layout.label}>
          Location
        </p>
        <p
          className={`${layout.path} ${layout.muted} ${styles.where}`}
          aria-labelledby="new-project-location-label"
        >
          {where}
        </p>
        <button
          type="button"
          className={`${layout.small} ${styles.change}`}
          onClick={() => void changeLocation()}
        >
          Change location
        </button>
      </div>
      <div className={`${layout.row} ${styles.actions}`}>
        <button type="submit" className={`${layout.primary} ${layout.large}`}>
          <Icon name="plus" />
          Create project
        </button>
        {props.children}
      </div>
    </form>
  )
}
