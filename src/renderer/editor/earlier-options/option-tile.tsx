// One option of a run (ED-4b): a button showing the whole picture, named "Use option {n} from
// {time}". The layer's own picture is ringed in the accent colour with a check mark "In use"
// (aria-pressed); a new run's other pictures carry an accent dot "New result". A missing file
// is disabled and says "file not found". A placeholder tile holds a turning spinner while the
// picture is made.
import { Icon } from '@/renderer/ui/icon'
import { assetUrl } from '@/renderer/ui/asset-url'
import { StatusMark } from '@/renderer/ui/status-mark'
import type { EarlierOption } from '@/shared/schemas/queries/earlier-options'
import styles from './option-tile.module.css'

export type OptionTileProps = {
  projectId: string
  asset: EarlierOption['assets'][number]
  name: string
  used: boolean
  fresh: boolean
  disabled: boolean
  onUse: (assetId: string) => void
}

export function OptionTile(props: OptionTileProps) {
  const { asset } = props
  return (
    <li>
      <button
        type="button"
        className={styles.tile}
        aria-label={props.name}
        aria-pressed={props.used}
        disabled={props.disabled || asset.missing}
        onClick={() => props.onUse(asset.assetId)}
      >
        {asset.missing ? (
          <span className={styles.missing}>file not found</span>
        ) : (
          <img className={styles.thumb} src={assetUrl(props.projectId, asset.assetId)} alt="" />
        )}
        {props.used ? (
          <span className={`${styles.mark} ${styles.inUse}`}>
            <StatusMark tone="accent" icon="check" tip="In use" />
          </span>
        ) : (
          props.fresh && (
            <span className={styles.mark}>
              <StatusMark tone="accent" tip="New result" />
            </span>
          )
        )}
      </button>
    </li>
  )
}

// A picture still being made: the spinner icon turns (and pulses under reduce motion).
export function PendingTile() {
  return (
    <li>
      <span className={styles.pending} data-pending title="Working">
        <Icon name="spinner" />
      </span>
    </li>
  )
}
