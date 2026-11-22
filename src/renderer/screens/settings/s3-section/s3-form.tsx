// The three S3 values, saved together in one settings.update (spec/approvals.md, "Cloud
// storage: the S3 part"). A refused save shows the command's sentence and keeps the typed text.
// The examples are placeholders (SET-4): no hint lines.
import { useState, type FormEvent } from 'react'
import { useApp } from '@/renderer/app/app-context'
import type { Settings } from '@/shared/schemas/settings'
import { NoticeLine } from '@/renderer/screens/settings/notice-line'
import layout from '@/renderer/ui/layout.module.css'
import styles from './s3-section.module.css'

type S3 = NonNullable<Settings['storage']['s3']>

const FIELD = `${layout.field} ${layout.inline}`

export function S3Form(props: { saved: S3 | null }) {
  const command = useApp((s) => s.command)
  const [bucket, setBucket] = useState(props.saved?.bucket ?? '')
  const [region, setRegion] = useState(props.saved?.region ?? '')
  const [prefix, setPrefix] = useState(props.saved?.prefix ?? '')
  const [refusal, setRefusal] = useState<string | null>(null)

  async function save(event: FormEvent) {
    event.preventDefault()
    const s3 = { bucket: bucket.trim(), region: region.trim(), prefix: prefix.trim() }
    const result = await command('settings.update', { storage: { s3 } })
    setRefusal(result.ok ? null : result.error.message)
  }

  return (
    <form className={styles.form} onSubmit={(e) => void save(e)}>
      <div className={FIELD}>
        <label htmlFor="s3-bucket">Bucket</label>
        <input
          id="s3-bucket"
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={bucket}
          onChange={(e) => setBucket(e.target.value)}
        />
      </div>
      <div className={FIELD}>
        <label htmlFor="s3-region">Region</label>
        <input
          id="s3-region"
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="eu-west-1"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          aria-describedby={refusal === null ? undefined : 's3-refusal'}
        />
      </div>
      <div className={FIELD}>
        <label htmlFor="s3-prefix">Folder</label>
        <input
          id="s3-prefix"
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="Whole bucket"
          aria-label="Folder in the bucket"
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
        />
      </div>
      {refusal !== null && (
        <NoticeLine kind="danger" id="s3-refusal">
          {refusal}
        </NoticeLine>
      )}
      <div className={layout.row}>
        <button type="submit" className={layout.primary}>
          Save
        </button>
      </div>
    </form>
  )
}
