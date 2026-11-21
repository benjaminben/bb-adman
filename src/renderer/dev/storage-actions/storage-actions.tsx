// Pick a storage, then upload a file, list or remove everything in adman-hand-test/ there,
// through dev.storage (SPEC 4.2, 14 slice I). A missing key opens the key dialog (FR-171).
// Dropbox is offered only when HAND_TEST_DROPBOX is true (SPEC 14 M5, slice G).
import { useState } from 'react'
import { useApp } from '@/renderer/app/app-context'
import { storageText } from '@/renderer/dev/result-text'
import { HAND_TEST_DROPBOX } from '@/shared/config/dev-tools'
import layout from '@/renderer/ui/layout.module.css'

type Action = 'write' | 'list' | 'remove'

export function StorageActions() {
  const command = useApp((s) => s.command)
  const [storage, setStorage] = useState('local')
  const [filePath, setFilePath] = useState('')
  const [status, setStatus] = useState('')

  async function run(action: Action) {
    setStatus('Working...')
    const input = action === 'write' ? { storage, action, filePath } : { storage, action }
    setStatus(storageText(await command('dev.storage', input)))
  }

  return (
    <div className={layout.card}>
      <h2>Storage</h2>
      <p>Every action touches only the folder adman-hand-test/ in the chosen storage.</p>
      <div className={layout.field}>
        <label htmlFor="hand-test-storage">Storage</label>
        <select id="hand-test-storage" value={storage} onChange={(e) => setStorage(e.target.value)}>
          <option value="local">This computer (app data folder)</option>
          <option value="s3">Amazon S3</option>
          {HAND_TEST_DROPBOX && <option value="dropbox">Dropbox</option>}
        </select>
      </div>
      <div className={layout.field}>
        <label htmlFor="hand-test-file">File to upload (full path)</label>
        <input
          id="hand-test-file"
          type="text"
          value={filePath}
          onChange={(e) => setFilePath(e.target.value)}
        />
      </div>
      <div className={layout.row}>
        <button type="button" onClick={() => void run('write')}>
          Upload
        </button>
        <button type="button" onClick={() => void run('list')}>
          List
        </button>
        <button type="button" onClick={() => void run('remove')}>
          Remove all
        </button>
      </div>
      <p role="status">{status}</p>
    </div>
  )
}
