// DLG-4b: one fan-out cost line, drawn with the id the dialog lists in its description: a
// MoneyLine when paid, a plain line otherwise, nothing when nothing of its kind is sent. And
// the providers a fill may go to.
import { MoneyLine } from '@/renderer/ui/money-line'
import type { RunCost } from '@/renderer/dialogs/run-dialog/run-summary'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import type { ComfyInfo } from '@/shared/schemas/queries/comfy'
import styles from './fan-out.module.css'

export function CostLine(props: { id: string; cost: RunCost | null }) {
  const { cost } = props
  if (cost === null) return null
  if (cost.paid) return <MoneyLine id={props.id}>{cost.words}</MoneyLine>
  return (
    <p id={props.id} className={styles.line}>
      {cost.words}
    </p>
  )
}

// Image providers that can run now; ComfyUI only with an offered `extend` workflow.
export function fillProviders(providers: ProviderInfo[], info: ComfyInfo | null) {
  const extend = info?.workflows.find((w) => w.offered && w.job === 'extend')
  const listed = providers.filter((p) => p.available && p.jobs.includes('image'))
  return {
    list: listed.filter((p) => p.id !== 'comfyui' || extend),
    trial: extend?.status === 'trial',
  }
}
