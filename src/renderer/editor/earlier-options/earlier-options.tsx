// "Earlier options" (spec/screens-ai.md; FR-248, FR-216, FR-218; workflow 5.8 step 5): every
// picture and cut-out run of the layer, newest first, ten at first and ten more per "Show
// more". Choosing an option sends one layer.update that sets the source and clears the crop:
// one undo entry, no provider call. A succeeded run not yet looked at is marked seen once,
// when it is drawn. A locked layer's buttons are disabled.
// R2E-5 (spec/phases/round-2-editor.md D6): the run named by newJobId, while it goes or once it
// kept pictures, is drawn first under "New pictures" (new-options.tsx); the other runs follow.
// ED-4b: "Earlier options" is a Section folded at first with the number of runs as its summary;
// it opens when its newest run failed, so a failure is never folded shut by default.
import { useEffect, useRef, useState } from 'react'
import { useApp } from '@/renderer/app/app-context'
import { EmptyState } from '@/renderer/ui/empty-state'
import { plural } from '@/renderer/ui/plural'
import { Section } from '@/renderer/ui/section'
import type { EarlierOptions as Reply } from '@/shared/schemas/queries/earlier-options'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { NewOptions } from './new-options'
import { RunBlock } from './run-block'
import { useEarlierOptions } from './use-earlier-options'
import styles from './earlier-options.module.css'

const PAGE = 10
const FOLD_ID = 'props.earlier'

// The named run is new while it is the layer's newest and is going or kept pictures; a later
// run (a cut-out, an agent's) is above it in the plain newest-first order.
function freshOf(reply: Reply | null, newJobId: string | undefined) {
  const newest = reply?.[0] ?? null
  if (newest === null || newest.job.id !== newJobId) return null
  const { status } = newest.job
  const going = status === 'queued' || status === 'running'
  return going || (status === 'succeeded' && newest.assets.length > 0) ? newest : null
}

// The newest listed run when it failed: the Section is opened for it once, as a click on its
// header would, so the failure is not folded shut. The fold memory then says open.
function useFailureOpens(failedId: string | null) {
  const body = useRef<HTMLDivElement>(null)
  const opened = useRef<string | null>(null)
  useEffect(() => {
    if (failedId === null || opened.current === failedId) return
    opened.current = failedId
    const head = body.current?.closest('section')?.querySelector('[aria-expanded]')
    if (head instanceof HTMLButtonElement && head.getAttribute('aria-expanded') === 'false') {
      head.click()
    }
  }, [failedId])
  return body
}

export type EarlierOptionsProps = {
  projectId: string
  layer: LayerRow
  // The run the Generate panel started, drawn first under "New pictures".
  newJobId?: string
}

export function EarlierOptions(props: EarlierOptionsProps) {
  const { projectId, layer } = props
  const command = useApp((s) => s.command)
  const reply = useEarlierOptions(projectId, layer)
  const [limit, setLimit] = useState(PAGE)
  const marked = useRef(new Set<string>())
  const fresh = freshOf(reply, props.newJobId)
  const rest = (reply ?? []).filter((option) => option !== fresh)
  const shown = rest.slice(0, limit)
  const inUse = layer.source?.assetId ?? null
  const failedId = rest[0]?.job.status === 'failed' ? rest[0].job.id : null
  const body = useFailureOpens(failedId)

  const unseenKey = (fresh ? [fresh, ...shown] : shown)
    .filter(({ job }) => job.status === 'succeeded' && job.seenAt === null)
    .map(({ job }) => job.id)
    .join(' ')

  useEffect(() => {
    const unseen = unseenKey === '' ? [] : unseenKey.split(' ')
    const jobIds = unseen.filter((id) => !marked.current.has(id))
    if (jobIds.length === 0) return
    jobIds.forEach((id) => marked.current.add(id))
    void command('job.markSeen', { projectId, jobIds })
  }, [command, projectId, unseenKey])

  function use(assetId: string) {
    if (assetId === inUse) return
    void command('layer.update', {
      projectId,
      layerId: layer.id,
      patch: { source: { assetId }, geometry: { crop: null } },
    })
  }

  return (
    <>
      {fresh && (
        <NewOptions
          projectId={projectId}
          option={fresh}
          inUse={inUse}
          locked={layer.locked}
          onUse={use}
        />
      )}
      <Section
        id={FOLD_ID}
        title="Earlier options"
        level={4}
        fold="closed"
        {...(reply === null
          ? {}
          : { summary: rest.length === 0 ? 'No runs' : plural(rest.length, 'run') })}
      >
        <div ref={body} className={styles.body}>
          {reply !== null && rest.length === 0 && !fresh && (
            <EmptyState icon="clock" words="No earlier options yet" />
          )}
          {shown.length > 0 && (
            <ul className={styles.runs}>
              {shown.map((option) => (
                <RunBlock
                  key={option.job.id}
                  projectId={projectId}
                  option={option}
                  inUse={inUse}
                  locked={layer.locked}
                  onUse={use}
                />
              ))}
            </ul>
          )}
          {rest.length > limit && (
            <button type="button" onClick={() => setLimit(limit + PAGE)}>
              Show more
            </button>
          )}
        </div>
      </Section>
    </>
  )
}
