// The name written into each report (A-201, SET-3): an inline text field with its help in an
// InfoTip. It saves when left or on Enter, after the settings schema accepts the value; a
// refused value keeps what was typed and shows the schema's words as one danger line under it.
import { useState, type FormEvent } from 'react'
import { useApp } from '@/renderer/app/app-context'
import { NoticeLine } from '@/renderer/screens/settings/notice-line'
import { InfoTip } from '@/renderer/ui/info-tip'
import { reportsSettings } from '@/shared/schemas/settings'
import layout from '@/renderer/ui/layout.module.css'
import styles from './export-section.module.css'

const ISSUE_ID = 'export-name-issue'

export function ReportNameField(props: { saved: string }) {
  const command = useApp((s) => s.command)
  const [typed, setTyped] = useState(props.saved)
  const [issue, setIssue] = useState<string | null>(null)

  function save() {
    const parsed = reportsSettings.shape.exporterName.safeParse(typed)
    if (!parsed.success) return setIssue(parsed.error.issues[0]?.message ?? null)
    setIssue(null)
    if (parsed.data === props.saved) return
    void command('settings.update', { reports: { exporterName: parsed.data } })
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    save()
  }

  return (
    <form
      className={`${layout.field} ${layout.inline} ${styles.row} ${styles.name}`}
      onSubmit={submit}
    >
      <span className={styles.labelWithTip}>
        <label htmlFor="export-name">Report name</label>
        <InfoTip about="report name">
          Written into each report as the person who exported. It is not checked.
        </InfoTip>
      </span>
      <input
        id="export-name"
        type="text"
        autoComplete="off"
        placeholder="Name not set"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        onBlur={save}
        aria-invalid={issue !== null}
        aria-describedby={issue === null ? undefined : ISSUE_ID}
      />
      {issue !== null && (
        <span className={styles.issue}>
          <NoticeLine kind="danger" id={ISSUE_ID}>
            {issue}
          </NoticeLine>
        </span>
      )}
    </form>
  )
}
