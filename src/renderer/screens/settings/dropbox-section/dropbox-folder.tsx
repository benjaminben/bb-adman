// The folder inside the Dropbox app folder, saved with storage.setDropboxFolder (P9-6) on Enter
// or when the field is left (SET-6, choice C-4), then "Saved". Outer spaces are trimmed before
// saving; an empty folder means the app folder itself, as before. A refused save shows the
// command's sentence and keeps the typed text. The example is the placeholder: no hint line.
import { useState } from 'react'
import { useApp } from '@/renderer/app/app-context'
import { SavedMark, onEnter, useSingleSave } from '@/renderer/screens/settings/saved-mark'
import layout from '@/renderer/ui/layout.module.css'
import { Refusal } from './refusal'
import styles from './dropbox-section.module.css'

export function DropboxFolder(props: { saved: string }) {
  const command = useApp((s) => s.command)
  const [refusal, setRefusal] = useState<string | null>(null)
  const field = useSingleSave(props.saved, async (rootPath) => {
    const result = await command('storage.setDropboxFolder', { rootPath })
    setRefusal(result.ok ? null : result.error.message)
    return result.ok
  })
  const save = () => void field.save(field.text.trim())

  return (
    <div className={styles.form}>
      <div className={`${layout.field} ${layout.inline}`}>
        <label htmlFor="dropbox-folder">Folder</label>
        <SavedMark shown={field.saved}>
          <input
            id="dropbox-folder"
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="App folder"
            aria-label="Folder in the app folder"
            value={field.text}
            onChange={(e) => field.type(e.target.value)}
            onBlur={save}
            onKeyDown={onEnter(save)}
            aria-describedby={refusal === null ? undefined : 'dropbox-folder-refusal'}
          />
        </SavedMark>
      </div>
      {refusal !== null && <Refusal id="dropbox-folder-refusal">{refusal}</Refusal>}
    </div>
  )
}
