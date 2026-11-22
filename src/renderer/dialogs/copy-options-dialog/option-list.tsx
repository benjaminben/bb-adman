// The options of a copy job (spec/screens-ai.md, "Copy options"), drawn as plain text. DLG-4b:
// each option is a tile in the reading face, chosen by an accent ring (a radio named by its
// text); choosing sends nothing. The dialog's "Use" sends layer.update { copy } and nothing else;
// a refusal shows in the dialog.
import { useId, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import { copyJobResult } from '@/shared/schemas/jobs/copy-options'
import type { JobRow } from '@/shared/schemas/rows/job'
import layout from '@/renderer/ui/layout.module.css'
import styles from './copy-options-dialog.module.css'

export function optionsOf(row: JobRow): string[] {
  const parsed = copyJobResult.safeParse(row.result)
  return parsed.success ? parsed.data.options : []
}

export function OptionTiles(props: {
  options: string[]
  chosen: number | null
  disabled: boolean
  onChoose: (index: number) => void
}) {
  const baseId = useId()
  return (
    <fieldset className={styles.group} disabled={props.disabled}>
      <legend className={styles.hidden}>Options</legend>
      <ul className={styles.options}>
        {props.options.map((option, i) => (
          <li key={`${i}:${option}`} className={styles.option}>
            <input
              type="radio"
              id={`${baseId}-${i}`}
              name={baseId}
              className={styles.radio}
              aria-labelledby={`${baseId}-${i}-text`}
              checked={props.chosen === i}
              onChange={() => props.onChoose(i)}
            />
            <label htmlFor={`${baseId}-${i}`} className={styles.tile}>
              <p id={`${baseId}-${i}-text`} className={`${layout.reading} ${styles.text}`}>
                {option}
              </p>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  )
}

// "Use": sends layer.update { copy } and nothing else; closes on success, keeps the refusal.
export function useApplyCopy(projectId: string, layerId: string, onUsed: () => void) {
  const api = useApi()
  const [refusal, setRefusal] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function apply(copy: string) {
    setBusy(true)
    setRefusal(null)
    const reply = await api.command('layer.update', { projectId, layerId, patch: { copy } })
    setBusy(false)
    if (reply.ok) onUsed()
    else setRefusal(reply.error.message)
  }

  return { apply, busy, refusal }
}
