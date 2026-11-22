// The Checks tab of the campaign page (CAMP-4; spec/phases/phase-06.md, design addition 8).
// "Run checks" sends check.run { campaignId } once per click and is disabled while it runs; a
// refusal shows its own message under the header. The table holds one row group per checked
// post from check.results (read again on project.changed), in the campaign's variant order.
// With no post checked, "Not checked yet" shows under the header: the header's "Run checks" is
// its action, so the view keeps one primary button (AP-7) and the button never moves.
import { useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type { CampaignTabProps as CampaignSectionProps } from '@/renderer/screens/campaign/campaign-overview'
import { EmptyState } from '@/renderer/ui/empty-state'
import layout from '@/renderer/ui/layout.module.css'
import type { VariantCheckState } from '@/shared/schemas/queries/check'
import { CheckHead } from './check-head'
import { CheckTable } from './check-table'
import { hasBrandWarning, summaryCounts } from './check-words'
import { rowButtonId, type Post } from './post-rows'
import { useCheckResults } from './use-check-results'
import styles from './check-panel.module.css'

function Refused(props: { message: string }) {
  return (
    <p role="alert" className={`${layout.notice} ${layout.danger}`}>
      {props.message}
    </p>
  )
}

export function CheckPanel(props: CampaignSectionProps) {
  const api = useApi()
  const read = useCheckResults(props.projectId, props.campaignId)
  const [running, setRunning] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)
  const [open, setOpen] = useState<Set<string>>(new Set())

  const run = async () => {
    if (running) return
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
  const posts: Post[] = props.data.variants.flatMap((v) => {
    const state = byId.get(v.id)
    return state ? [{ variant: v, state }] : []
  })
  const counts = summaryCounts(posts.map((p) => p.state))
  const firstWarned = posts.find((p) => hasBrandWarning(p.state))
  const firstFinding = firstWarned?.state.results.find(
    (r) => r.group === 'brand-legal' && r.status === 'warn',
  )?.findings[0]?.message

  const toggle = (id: string) =>
    setOpen((now) => {
      const next = new Set(now)
      if (!next.delete(id)) next.add(id)
      return next
    })

  const showWarned = () => {
    if (firstWarned === undefined) return
    setOpen((now) => new Set(now).add(firstWarned.variant.id))
    document.getElementById(rowButtonId(firstWarned.variant.id))?.focus()
  }

  const empty = read.kind === 'done' && posts.length === 0
  return (
    <section className={styles.panel} aria-label="Checks">
      <CheckHead
        running={running}
        warnings={counts.warnings}
        firstFinding={firstFinding}
        stale={counts.stale}
        onRun={() => void run()}
        onShowWarned={showWarned}
      />
      {refusal !== null && <Refused message={refusal} />}
      {read.kind === 'refused' && <Refused message={read.message} />}
      {empty && <EmptyState icon="shield" words="Not checked yet" />}
      {posts.length > 0 && (
        <CheckTable projectId={props.projectId} posts={posts} open={open} onToggle={toggle} />
      )}
    </section>
  )
}
