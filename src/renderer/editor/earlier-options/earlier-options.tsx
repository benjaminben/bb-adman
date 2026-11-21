// "Earlier options" (spec/screens-ai.md; FR-248, FR-216, FR-218; workflow 5.8 step 5): every
// picture and cut-out run of the layer, newest first, ten at first and ten more per "Show
// more". Choosing an option sends one layer.update that sets the source and clears the crop:
// one undo entry, no provider call. A succeeded run not yet looked at is marked seen once,
// when it is drawn. A locked layer's buttons are disabled.
import { useEffect, useRef, useState } from 'react'
import { useApp } from '@/renderer/app/app-context'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { RunBlock } from './run-block'
import { useEarlierOptions } from './use-earlier-options'
import styles from './earlier-options.module.css'

const PAGE = 10

export type EarlierOptionsProps = {
  projectId: string
  layer: LayerRow
}

export function EarlierOptions(props: EarlierOptionsProps) {
  const { projectId, layer } = props
  const command = useApp((s) => s.command)
  const reply = useEarlierOptions(projectId, layer)
  const [limit, setLimit] = useState(PAGE)
  const marked = useRef(new Set<string>())
  const shown = (reply ?? []).slice(0, limit)
  const inUse = layer.source?.assetId ?? null

  const unseenKey = shown
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
      <h3 id={`${layer.id}-earlier`} className={styles.heading}>
        Earlier options
      </h3>
      {reply !== null && reply.length === 0 && (
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
      {reply !== null && reply.length > limit && (
        <button type="button" onClick={() => setLimit(limit + PAGE)}>
          Show more
        </button>
      )}
    </section>
  )
}
