// The export dialog's format controls (spec/phases/phase-08.md "The output folder"; DLG-6a):
// the picture format as two segments, PNG and JPG, the JPG quality for JPG, and the frames per
// second while a video ad is ticked. The folder row is FolderRow.
import { useId } from 'react'
import layout from '@/renderer/ui/layout.module.css'
import type { ExportRunInput } from '@/shared/schemas/commands/export'
import styles from './export-dialog.module.css'

export type ExportChoices = {
  imageFormat: ExportRunInput['imageFormat']
  // As typed; a whole number from 1 to 100 is needed to export.
  jpgQuality: string
  fps: ExportRunInput['fps']
}

export type ExportOptionsProps = {
  choices: ExportChoices
  showFps: boolean
  disabled: boolean
  onChange: (choices: ExportChoices) => void
}

const FORMATS = [
  { value: 'png', label: 'PNG' },
  { value: 'jpg', label: 'JPG' },
] as const

export function ExportOptions(props: ExportOptionsProps) {
  const { choices, disabled } = props
  const id = useId()
  const set = (over: Partial<ExportChoices>) => props.onChange({ ...choices, ...over })

  return (
    <div className={styles.options}>
      <div className={`${layout.field} ${layout.inline}`}>
        <span className={layout.label}>Format</span>
        <div role="group" aria-label="Picture format" className={layout.seg}>
          {FORMATS.map((format) => (
            <button
              key={format.value}
              type="button"
              aria-pressed={choices.imageFormat === format.value}
              disabled={disabled}
              onClick={() => set({ imageFormat: format.value })}
            >
              {format.label}
            </button>
          ))}
        </div>
      </div>
      {choices.imageFormat === 'jpg' && (
        <div className={`${layout.field} ${layout.inline}`}>
          <label htmlFor={`${id}-quality`}>Quality</label>
          <input
            id={`${id}-quality`}
            aria-label="JPG quality"
            type="number"
            min={1}
            max={100}
            step={1}
            value={choices.jpgQuality}
            disabled={disabled}
            onChange={(e) => set({ jpgQuality: e.target.value })}
          />
        </div>
      )}
      {props.showFps && (
        <div className={`${layout.field} ${layout.inline}`}>
          <label htmlFor={`${id}-fps`}>Frames per second</label>
          <select
            id={`${id}-fps`}
            value={String(choices.fps)}
            disabled={disabled}
            onChange={(e) => set({ fps: e.target.value === '60' ? 60 : 30 })}
          >
            <option value="30">30</option>
            <option value="60">60</option>
          </select>
        </div>
      )}
    </div>
  )
}

// The quality to send, or null while the typed value is not a whole number from 1 to 100.
export function qualityOf(typed: string): number | null {
  const value = Number(typed)
  return /^\d+$/.test(typed.trim()) && value >= 1 && value <= 100 ? value : null
}
