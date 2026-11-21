// The options of a copy job (spec/screens-ai.md, "Copy options"): each as plain text with "Use
// this text", which sends layer.update { copy } and nothing else. A refusal shows here.
import { useId, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import { copyJobResult } from '@/shared/schemas/jobs/copy-options'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import type { JobRow } from '@/shared/schemas/rows/job'
import styles from './copy-options-dialog.module.css'

type Props = { projectId: string; layerId: string; row: JobRow; onUsed: () => void }

export function OptionList(props: Props) {
  const api = useApi()
  const baseId = useId()
  const [refusal, setRefusal] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const parsed = copyJobResult.safeParse(props.row.result)
  const options = parsed.success ? parsed.data.options : []

  async function use(copy: string) {
    setBusy(true)
    setRefusal(null)
    const patch = { copy }
    const reply = await api.command('layer.update', {
      projectId: props.projectId,
      layerId: props.layerId,
      patch,
    })
    setBusy(false)
    if (reply.ok) props.onUsed()
    else setRefusal(reply.error.message)
  }

  return (
    <>
      <ul className={styles.options}>
        {options.map((option, i) => (
          <li key={`${i}:${option}`} className={styles.option}>
            <p id={`${baseId}-${i}`} className={`${layout.reading} ${styles.text}`}>
              {option}
            </p>
            <button
              type="button"
              aria-describedby={`${baseId}-${i}`}
              disabled={busy}
              onClick={() => void use(option)}
            >
              Use this text
            </button>
          </li>
        ))}
      </ul>
      {refusal !== null && (
        <p role="alert" className={`${layout.notice} ${layout.danger}`}>
          <Icon name="alert" />
          {refusal}
        </p>
      )}
    </>
  )
}
