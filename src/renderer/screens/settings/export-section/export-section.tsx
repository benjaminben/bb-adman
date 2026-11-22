// Settings "Export" (P8-10, A-201, SET-3): picture format, JPG quality, frame rate and the
// name written into reports, as inline fields. The Segmented groups save on click; the two
// typed fields save when left or on Enter, after the same checks as before.
import { useState } from 'react'
import { useApp } from '@/renderer/app/app-context'
import { Section } from '@/renderer/ui/section'
import layout from '@/renderer/ui/layout.module.css'
import { ReportNameField } from './report-name-field'
import styles from './export-section.module.css'

type Choice<T> = { value: T; label: string }

const FORMATS: Choice<'png' | 'jpg'>[] = [
  { value: 'png', label: 'PNG' },
  { value: 'jpg', label: 'JPG' },
]
const RATES: Choice<30 | 60>[] = [
  { value: 30, label: '30 fps' },
  { value: 60, label: '60 fps' },
]

export function ExportSection() {
  const settings = useApp((s) => s.app?.settings)
  const command = useApp((s) => s.command)
  if (!settings) return null
  const { imageFormat, jpgQuality, fps } = settings.export
  return (
    <Section id="settings.export" title="Export" level={3} fold="none">
      <Segmented
        label="Picture"
        name="Picture format"
        choices={FORMATS}
        value={imageFormat}
        onChoose={(value) => void command('settings.update', { export: { imageFormat: value } })}
      />
      {imageFormat === 'jpg' && <QualityField saved={jpgQuality} />}
      <Segmented
        label="Frame rate"
        name="Frame rate"
        choices={RATES}
        value={fps}
        onChoose={(value) => void command('settings.update', { export: { fps: value } })}
      />
      <ReportNameField saved={settings.reports.exporterName} />
    </Section>
  )
}

function Segmented<T extends string | number>(props: {
  label: string
  name: string
  choices: Choice<T>[]
  value: T
  onChoose: (value: T) => void
}) {
  return (
    <div className={`${layout.field} ${layout.inline} ${styles.row}`}>
      <span className={layout.label}>{props.label}</span>
      <div role="group" aria-label={props.name} className={`${layout.seg} ${styles.seg}`}>
        {props.choices.map((choice) => (
          <button
            key={choice.value}
            type="button"
            aria-pressed={choice.value === props.value}
            onClick={() => choice.value !== props.value && props.onChoose(choice.value)}
          >
            {choice.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function QualityField(props: { saved: number }) {
  const command = useApp((s) => s.command)
  const [quality, setQuality] = useState(String(props.saved))

  function save() {
    const value = Number(quality)
    if (!Number.isInteger(value) || value < 1 || value > 100) return
    if (value === props.saved) return
    void command('settings.update', { export: { jpgQuality: value } })
  }

  return (
    <div className={`${layout.field} ${layout.inline} ${styles.row}`}>
      <label htmlFor="export-quality">Quality</label>
      <div className={`${layout.unitBox} ${styles.short}`}>
        <input
          id="export-quality"
          type="number"
          aria-label="JPG quality"
          min={1}
          max={100}
          step={1}
          value={quality}
          onChange={(e) => setQuality(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
        <span className={layout.unit}>%</span>
      </div>
    </div>
  )
}
