// One earlier run (spec/screens-ai.md, "Earlier options"): "{time} · {Provider} · Pictures"
// (or "Cut-out"), "Started by an agent" when so, its status, the failure sentence
// (ui/run-failure/) and Retry, then its options. Each option is a button showing the whole
// picture; the layer's own picture is "In use" (aria-pressed); a missing file is disabled.
import { EMPTY, useApp } from '@/renderer/app/app-context'
import { assetUrl } from '@/renderer/ui/asset-url'
import { RunFailure } from '@/renderer/ui/run-failure'
import type { EarlierOption } from '@/shared/schemas/queries/earlier-options'
import { RetryButton } from './retry-button'
import { runKind, runStatus, runTime } from './run-words'
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
  const status = runStatus(row)

  return (
    <li className={styles.run} data-run={row.id}>
      <p className={styles.head}>{`${time} · ${label} · ${runKind(row)}`}</p>
      {row.startedBy === 'agent' && <p className={styles.muted}>Started by an agent</p>}
      {status !== null && (
        <div className={styles.status}>
          <span>{status}</span>
          {row.status === 'failed' && (
            <RetryButton
              projectId={projectId}
              row={row}
              provider={provider}
              disabled={props.locked}
            />
          )}
        </div>
      )}
      {row.status === 'failed' && (
        <RunFailure row={row} projectId={projectId} provider={provider} providerLabel={label} />
      )}
      {option.assets.length > 0 && (
        <ul className={styles.options}>
          {option.assets.map((asset, i) => {
            const used = asset.assetId === props.inUse
            return (
              <li key={asset.assetId}>
                <button
                  type="button"
                  className={styles.option}
                  aria-label={`Use option ${i + 1} from ${time}`}
                  aria-pressed={used}
                  disabled={props.locked || asset.missing}
                  onClick={() => props.onUse(asset.assetId)}
                >
                  {asset.missing ? (
                    <span className={styles.missing}>file not found</span>
                  ) : (
                    <img className={styles.thumb} src={assetUrl(projectId, asset.assetId)} alt="" />
                  )}
                  {used && <span className={styles.inUse}>In use</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </li>
  )
}
