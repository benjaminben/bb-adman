// One earlier run (spec/screens-ai.md, "Earlier options"; ED-4b): a thin row with the time, a
// kind icon (its word hidden), a bot mark when an agent started it, its status as a StatusMark
// and Retry as an icon button; the provider is in the row's `title`. A failed run's sentence
// (ui/run-failure/) stays visible under the row. Then its options as tiles (option-tile.tsx).
import { EMPTY, useApp } from '@/renderer/app/app-context'
import { RunFailure } from '@/renderer/ui/run-failure'
import { StatusMark } from '@/renderer/ui/status-mark'
import type { EarlierOption } from '@/shared/schemas/queries/earlier-options'
import { OptionTile } from './option-tile'
import { RetryButton } from './retry-button'
import { runKind, runMark, runTime } from './run-words'
import styles from './run-block.module.css'

export type RunBlockProps = {
  projectId: string
  option: EarlierOption
  inUse: string | null
  locked: boolean
  onUse: (assetId: string) => void
}

export function RunBlock(props: RunBlockProps) {
  const { projectId, option } = props
  const row = option.job
  const providers = useApp((s) => s.app?.providers ?? EMPTY)
  const provider = providers.find((p) => p.id === row.provider)
  const label = provider?.label ?? row.provider ?? 'The provider'
  const time = runTime(row.createdAt)
  const kind = runKind(row)
  const mark = runMark(row)

  return (
    <li className={styles.run} data-run={row.id} title={`${time} · ${label} · ${kind}`}>
      <div className={styles.head}>
        <span className={styles.time}>{time}</span>
        <StatusMark tone="none" icon={row.kind === 'cutout' ? 'scissors' : 'image'} tip={kind} />
        {row.startedBy === 'agent' && (
          <StatusMark tone="info" icon="bot" tip="Started by an agent" />
        )}
        {mark !== null && <StatusMark {...mark} />}
        {row.status === 'failed' && (
          <span className={styles.retry}>
            <RetryButton
              projectId={projectId}
              row={row}
              provider={provider}
              disabled={props.locked}
            />
          </span>
        )}
      </div>
      {row.status === 'failed' && (
        <RunFailure row={row} projectId={projectId} provider={provider} providerLabel={label} />
      )}
      {option.assets.length > 0 && (
        <ul className={styles.options}>
          {option.assets.map((asset, i) => (
            <OptionTile
              key={asset.assetId}
              projectId={projectId}
              asset={asset}
              name={`Use option ${i + 1} from ${time}`}
              used={asset.assetId === props.inUse}
              fresh={false}
              disabled={props.locked}
              onUse={props.onUse}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
