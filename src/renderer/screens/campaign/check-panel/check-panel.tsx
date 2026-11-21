// The "Checks" section of the campaign overview (spec/phases/phase-06.md, design addition 8).
// "Run checks" sends check.run { campaignId }, "Checking…" while it runs; a refusal shows its own
// message. The summary and one block per checked variant come from check.results, read again
// on project.changed (check.run emits it). Blocks follow the campaign's variant order.
import { useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type { CampaignSectionProps } from '@/renderer/screens/campaign/campaign-sections'
import { BusySpinner } from '@/renderer/ui/dialog-frame'
import layout from '@/renderer/ui/layout.module.css'
import type { VariantCheckState } from '@/shared/schemas/queries/check'
import { CheckBlock } from './check-block'
import { summaryLine } from './check-words'
import { useCheckResults } from './use-check-results'
import styles from './check-panel.module.css'

export function CheckPanel(props: CampaignSectionProps) {
  const api = useApi()
  const read = useCheckResults(props.projectId, props.campaignId)
  const [running, setRunning] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)

  const run = async () => {
    setRunning(true)
    setRefusal(null)
    const reply = await api.command('check.run', {
      projectId: props.projectId,
      campaignId: props.campaignId,
    })
    setRunning(false)
    if (!reply.ok) setRefusal(reply.error.message)
  }

  const byId = new Map<string, VariantCheckState>()
  if (read.kind === 'done') read.states.forEach((s) => byId.set(s.variantId, s))
  const blocks = props.data.variants.flatMap((v) => {
    const state = byId.get(v.id)
    return state ? [{ variant: v, state }] : []
  })

  return (
    <section className={layout.card} aria-labelledby="checks-heading">
      <h2 id="checks-heading">Checks</h2>
      <div className={layout.row}>
        <button type="button" disabled={running} onClick={() => void run()}>
          Run checks
        </button>
        {running && (
          <p role="status" className={styles.busy}>
            <BusySpinner />
            Checking…
          </p>
        )}
      </div>
      {refusal !== null && (
        <p role="alert" className={`${layout.notice} ${layout.danger}`}>
          {refusal}
        </p>
      )}
      {read.kind === 'refused' && (
        <p role="alert" className={`${layout.notice} ${layout.danger}`}>
          {read.message}
        </p>
      )}
      {read.kind === 'done' && (
        <>
          <p className={layout.muted}>{summaryLine(blocks.map((b) => b.state))}</p>
          {blocks.map((b) => (
            <CheckBlock key={b.variant.id} variant={b.variant} state={b.state} />
          ))}
        </>
      )}
    </section>
  )
}
