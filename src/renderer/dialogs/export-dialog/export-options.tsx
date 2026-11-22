// The export dialog's folder and format controls (spec/phases/phase-08.md "The output
// folder"): the folder comes only from the system picker and is drawn as text, never typed or
// edited; the picture format, the JPG quality for JPG, the frames per second while a video ad
// is ticked, and the replace sentence (A-193).
import { useId } from 'react'
import layout from '@/renderer/ui/layout.module.css'
import { OVERWRITE_NOTE } from '@/shared/export/messages'
import type { ExportRunInput } from '@/shared/schemas/commands/export'
import styles from './export-dialog.module.css'

export type ExportChoices = {
  imageFormat: ExportRunInput['imageFormat']
  // As typed; a whole number from 1 to 100 is needed to export.
  jpgQuality: string
  fps: ExportRunInput['fps']
}

export type ExportOptionsProps = {
  folder: string | null
  choices: ExportChoices
  showFps: boolean
  disabled: boolean
  onChooseFolder: () => void
  onChange: (choices: ExportChoices) => void
}

export function ExportOptions(props: ExportOptionsProps) {
  const { choices, disabled } = props
  const id = useId()
  const set = (over: Partial<ExportChoices>) => props.onChange({ ...choices, ...over })

  return (
    <>
      <div className={layout.field}>
        <p className={layout.label}>Folder</p>
        <div className={styles.folder}>
          {props.folder === null ? (
            <p className={layout.muted}>No folder chosen</p>
          ) : (
            <p className={layout.path}>{props.folder}</p>
          )}
          <button type="button" disabled={disabled} onClick={props.onChooseFolder}>
            Choose folder…
          </button>
        </div>
      </div>
      <div className={styles.options}>
        <div className={layout.field}>
          <label htmlFor={`${id}-format`}>Picture format</label>
          <select
            id={`${id}-format`}
            value={choices.imageFormat}
            disabled={disabled}
            onChange={(e) => set({ imageFormat: e.target.value === 'jpg' ? 'jpg' : 'png' })}
          >
            <option value="png">PNG</option>
            <option value="jpg">JPG</option>
          </select>
        </div>
        {choices.imageFormat === 'jpg' && (
          <div className={layout.field}>
            <label htmlFor={`${id}-quality`}>JPG quality</label>
            <input
              id={`${id}-quality`}
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
          <div className={layout.field}>
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
      <p className={styles.note}>{OVERWRITE_NOTE}</p>
    </>
  )
}

// The quality to send, or null while the typed value is not a whole number from 1 to 100.
export function qualityOf(typed: string): number | null {
  const value = Number(typed)
  return /^\d+$/.test(typed.trim()) && value >= 1 && value <= 100 ? value : null
}
