// "Earlier options" (spec/screens-ai.md; FR-248, FR-216, FR-218; workflow 5.8 step 5): every
// picture and cut-out run of the layer, newest first, ten at first and ten more per "Show
// more". Choosing an option sends one layer.update that sets the source and clears the crop:
// one undo entry, no provider call. A succeeded run not yet looked at is marked seen once,
// when it is drawn. A locked layer's buttons are disabled. The title names the region but is
// not an h element: the properties panel keeps one heading, the layer's name.
// R2E-5 (spec/phases/round-2-editor.md D6): the run named by newJobId is drawn first under
// "New pictures" (new-options.tsx), its own region inside this one, so that a picker of the
// layer's options finds every run here; the other runs follow under the title.
import { useEffect, useRef, useState } from 'react'
import { useApp } from '@/renderer/app/app-context'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { NewOptions } from './new-options'
import { RunBlock } from './run-block'
import { useEarlierOptions } from './use-earlier-options'
import styles from './earlier-options.module.css'

const PAGE = 10

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
  // The named run is new while it is the layer's newest; a later run (a cut-out, an agent's)
  // is above it in the plain newest-first order.
  const newest = reply?.[0] ?? null
  const fresh = newest !== null && newest.job.id === props.newJobId ? newest : null
  const rest = (reply ?? []).filter((option) => option !== fresh)
  const shown = rest.slice(0, limit)
  const inUse = layer.source?.assetId ?? null

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
    <section className={styles.section} aria-labelledby={`${layer.id}-earlier`}>
      {fresh && (
        <NewOptions
          projectId={projectId}
          layerId={layer.id}
          option={fresh}
          inUse={inUse}
          locked={layer.locked}
          onUse={use}
        />
      )}
      <p id={`${layer.id}-earlier`} className={styles.heading}>
        Earlier options
      </p>
      {reply !== null && rest.length === 0 && !fresh && (
        <p className={styles.muted}>No earlier options for this layer.</p>
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
    </section>
  )
}
