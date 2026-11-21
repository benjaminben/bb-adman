// New project: a name, and a location that starts as the default from Settings (FR-004).
import { useState, type FormEvent } from 'react'
import { useApi, useApp, pickPath } from '@/renderer/app/app-context'
import styles from '@/renderer/screens/screens.module.css'

export function NewProjectForm() {
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
    <form className={styles.card} onSubmit={(e) => void submit(e)}>
      <h2>New project</h2>
      <label htmlFor="new-project-name">Project name</label>
      <input
        id="new-project-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoComplete="off"
        required
      />
      <p id="new-project-location-label" className={styles.label}>
        Location
      </p>
      <p className={styles.path} aria-labelledby="new-project-location-label">
        {where}
      </p>
      <div className={styles.row}>
        <button type="button" onClick={() => void changeLocation()}>
          Change location
        </button>
        <button type="submit" className={styles.primary}>
          Create project
        </button>
      </div>
    </form>
  )
}
