// The name written into each report (A-201, SET-3): an inline text field with its help in an
// InfoTip. It saves when left or on Enter, after the settings schema accepts the value; a
// refused value keeps what was typed and shows the schema's words as one danger line under it.
// A save that changed the name shows "Saved" for 2 seconds (SET-6).
import { useState, type FormEvent } from 'react'
import { useApp } from '@/renderer/app/app-context'
import { NoticeLine } from '@/renderer/screens/settings/notice-line'
import { SavedMark, useSingleSave } from '@/renderer/screens/settings/saved-mark'
import { InfoTip } from '@/renderer/ui/info-tip'
import { reportsSettings } from '@/shared/schemas/settings'
import layout from '@/renderer/ui/layout.module.css'
import styles from './export-section.module.css'

const ISSUE_ID = 'export-name-issue'

export function ReportNameField(props: { saved: string }) {
  const command = useApp((s) => s.command)
  const [issue, setIssue] = useState<string | null>(null)
  const field = useSingleSave(props.saved, async (exporterName) => {
    const result = await command('settings.update', { reports: { exporterName } })
    return result.ok
  })

  function save() {
    const parsed = reportsSettings.shape.exporterName.safeParse(field.text)
    if (!parsed.success) return setIssue(parsed.error.issues[0]?.message ?? null)
    setIssue(null)
    void field.save(parsed.data)
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
      <SavedMark shown={field.saved}>
        <input
          id="export-name"
          type="text"
          autoComplete="off"
          placeholder="Name not set"
          value={field.text}
          onChange={(e) => field.type(e.target.value)}
          onBlur={save}
          aria-invalid={issue !== null}
          aria-describedby={issue === null ? undefined : ISSUE_ID}
        />
      </SavedMark>
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
