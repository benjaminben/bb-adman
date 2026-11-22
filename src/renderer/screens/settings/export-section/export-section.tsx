// Settings "Export" (P8-10, A-201): picture format, JPG quality, frames per second and the
// name shown in reports. Selects save on change; the two typed fields save when left or on
// Enter, after the settings schema accepts the value.
import { useState, type FormEvent } from 'react'
import { useApp } from '@/renderer/app/app-context'
import { NoticeLine } from '@/renderer/screens/settings/notice-line'
import { reportsSettings } from '@/shared/schemas/settings'
import layout from '@/renderer/ui/layout.module.css'
import styles from './export-section.module.css'

const HINT_ID = 'export-name-hint'
const ISSUE_ID = 'export-name-issue'

export function ExportSection() {
  const settings = useApp((s) => s.app?.settings)
  if (!settings) return null
  return (
    <section className={layout.card} aria-labelledby="export-title">
      <h2 id="export-title">Export</h2>
      <ExportControls
        imageFormat={settings.export.imageFormat}
        jpgQuality={settings.export.jpgQuality}
        fps={settings.export.fps}
      />
      <NameField saved={settings.reports.exporterName} />
    </section>
  )
}

function ExportControls(props: { imageFormat: 'png' | 'jpg'; jpgQuality: number; fps: 30 | 60 }) {
  const command = useApp((s) => s.command)
  const [quality, setQuality] = useState(String(props.jpgQuality))

  function saveQuality() {
    const value = Number(quality)
    if (!Number.isInteger(value) || value < 1 || value > 100) return
    if (value === props.jpgQuality) return
    void command('settings.update', { export: { jpgQuality: value } })
  }

  return (
    <div className={layout.formGrid}>
      <div className={layout.field}>
        <label htmlFor="export-format">Picture format</label>
        <select
          id="export-format"
          value={props.imageFormat}
          onChange={(e) =>
            void command('settings.update', {
              export: { imageFormat: e.target.value === 'jpg' ? 'jpg' : 'png' },
            })
          }
        >
          <option value="png">PNG</option>
          <option value="jpg">JPG</option>
        </select>
      </div>
      {props.imageFormat === 'jpg' && (
        <div className={layout.field}>
          <label htmlFor="export-quality">JPG quality</label>
          <input
            id="export-quality"
            type="number"
            min={1}
            max={100}
            step={1}
            value={quality}
            onChange={(e) => setQuality(e.target.value)}
            onBlur={saveQuality}
            onKeyDown={(e) => e.key === 'Enter' && saveQuality()}
          />
        </div>
      )}
      <div className={layout.field}>
        <label htmlFor="export-fps">Frames per second</label>
        <select
          id="export-fps"
          value={String(props.fps)}
          onChange={(e) =>
            void command('settings.update', { export: { fps: e.target.value === '60' ? 60 : 30 } })
          }
        >
          <option value="30">30</option>
          <option value="60">60</option>
        </select>
      </div>
    </div>
  )
}

function NameField(props: { saved: string }) {
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
    <form className={`${layout.field} ${styles.name}`} onSubmit={submit}>
      <label htmlFor="export-name">Name shown in reports</label>
      <input
        id="export-name"
        type="text"
        autoComplete="off"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        onBlur={save}
        aria-invalid={issue !== null}
        aria-describedby={issue === null ? HINT_ID : `${HINT_ID} ${ISSUE_ID}`}
      />
      <p id={HINT_ID} className={layout.muted}>
        Written into each report as the person who exported. It is not checked. Leave it empty to
        show &quot;name not set&quot;.
      </p>
      {issue !== null && (
        <NoticeLine kind="danger" id={ISSUE_ID}>
          {issue}
        </NoticeLine>
      )}
    </form>
  )
}
