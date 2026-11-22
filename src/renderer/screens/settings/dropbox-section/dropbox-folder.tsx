// The folder inside the Dropbox app folder, saved with storage.setDropboxFolder (P9-6). Outer
// spaces are trimmed before saving. A refused save shows the command's sentence and keeps the
// typed text. The example is the placeholder (SET-4): no hint line.
import { useState, type FormEvent } from 'react'
import { useApp } from '@/renderer/app/app-context'
import layout from '@/renderer/ui/layout.module.css'
import { Refusal } from './refusal'
import styles from './dropbox-section.module.css'

export function DropboxFolder(props: { saved: string }) {
  const command = useApp((s) => s.command)
  const [rootPath, setRootPath] = useState(props.saved)
  const [refusal, setRefusal] = useState<string | null>(null)

  async function save(event: FormEvent) {
    event.preventDefault()
    const result = await command('storage.setDropboxFolder', { rootPath: rootPath.trim() })
    setRefusal(result.ok ? null : result.error.message)
  }

  return (
    <form className={styles.form} onSubmit={(e) => void save(e)}>
      <div className={`${layout.field} ${layout.inline}`}>
        <label htmlFor="dropbox-folder">Folder</label>
        <input
          id="dropbox-folder"
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="App folder"
          aria-label="Folder in the app folder"
          value={rootPath}
          onChange={(e) => setRootPath(e.target.value)}
          aria-describedby={refusal === null ? undefined : 'dropbox-folder-refusal'}
        />
      </div>
      {refusal !== null && <Refusal id="dropbox-folder-refusal">{refusal}</Refusal>}
      <div className={layout.row}>
        <button type="submit" className={layout.primary}>
          Save folder
        </button>
      </div>
    </form>
  )
}
