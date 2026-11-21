// The S3 settings the hand test needs, saved with settings.update (SPEC 13.1, 14 slice I).
// Keys are not entered here: the key dialog asks for them, or Settings holds them.
import { useState, type FormEvent } from 'react'
import { useApp } from '@/renderer/app/app-context'
import { failedText } from './result-text'
import styles from '@/renderer/screens/screens.module.css'

export function S3SettingsForm() {
  const command = useApp((s) => s.command)
  const saved = useApp((s) => s.app?.settings.storage.s3 ?? null)
  const [bucket, setBucket] = useState(saved?.bucket ?? '')
  const [region, setRegion] = useState(saved?.region ?? '')
  const [prefix, setPrefix] = useState(saved?.prefix ?? '')
  const [status, setStatus] = useState('')

  async function save(event: FormEvent) {
    event.preventDefault()
    const result = await command('settings.update', { storage: { s3: { bucket, region, prefix } } })
    setStatus(failedText(result) ?? 'S3 settings saved.')
  }

  const field = (id: string, label: string, value: string, set: (v: string) => void) => (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <input id={id} type="text" value={value} onChange={(e) => set(e.target.value)} />
    </div>
  )

  return (
    <form className={styles.card} onSubmit={(e) => void save(e)}>
      <h2>Amazon S3 settings</h2>
      {field('hand-test-bucket', 'Bucket', bucket, setBucket)}
      {field('hand-test-region', 'Region', region, setRegion)}
      {field('hand-test-prefix', 'Prefix (optional)', prefix, setPrefix)}
      <button type="submit">Save S3 settings</button>
      <p role="status">{status}</p>
    </form>
  )
}
