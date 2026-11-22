// The last lines of the run dialog's body (DLG-4a, choice C-15): a video's length line when the
// provider changes the length, then the cost line, directly above the foot. A paid provider's
// cost is a MoneyLine; ComfyUI, the fake provider and other local ones keep a plain line. Both
// lines carry the ids the dialog lists in its accessible description.
import { MoneyLine } from '@/renderer/ui/money-line'
import type { RunCost } from './run-summary'
import styles from './run-dialog.module.css'

export function CostLines(props: {
  length: string | null
  lengthId: string
  cost: RunCost | null
  costId: string
  comfy: boolean
}) {
  const { cost } = props
  return (
    <>
      {props.length !== null && (
        <p id={props.lengthId} className={styles.summary}>
          {props.length}
        </p>
      )}
      {cost !== null &&
        (cost.paid ? (
          <MoneyLine id={props.costId}>{cost.words}</MoneyLine>
        ) : (
          <p id={props.costId} className={props.comfy ? styles.comfy : styles.summary}>
            {cost.words}
          </p>
        ))}
    </>
  )
}

// The ids of the lines that are drawn, for the dialog's `describedBy`.
export function describedIds(lines: Array<[string, boolean]>): string | undefined {
  const ids = lines.filter(([, drawn]) => drawn).map(([id]) => id)
  return ids.length > 0 ? ids.join(' ') : undefined
}
