// One missing asset: its name, its kind and library as words, and its "Find…" button. DLG-7:
// an alert mark first (its word "Missing" in the tooltip); once found the row moves to the
// "Found" list with a check mark and no button. Only the display name is drawn, never a path.
import type { MissingAsset } from './use-missing-assets'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import styles from './relink-dialog.module.css'

const KIND_WORDS: Record<MissingAsset['kind'], string> = {
  image: 'picture',
  video: 'video',
  font: 'font',
  text: 'text file',
  audio: 'sound file',
}

const LIBRARY_WORDS: Record<MissingAsset['library'], string> = {
  asset: 'asset library',
  reference: 'reference library',
}

export type MissingRowProps = {
  asset: MissingAsset
  finding: boolean
  disabled: boolean
  onFind: () => void
}

export function MissingRow(props: MissingRowProps) {
  const { asset } = props
  return (
    <li className={styles.row}>
      <span className={`${styles.mark} ${styles.missing}`} title="Missing">
        <Icon name="alert" size="small" />
      </span>
      <span className={styles.name}>{asset.displayName}</span>{' '}
      <span className={styles.muted}>
        {KIND_WORDS[asset.kind]}, {LIBRARY_WORDS[asset.library]}
      </span>{' '}
      <button
        type="button"
        className={layout.small}
        data-asset-id={asset.id}
        aria-label={`Find ${asset.displayName}`}
        disabled={props.disabled}
        onClick={props.onFind}
      >
        {props.finding ? 'Finding…' : 'Find…'}
      </button>
    </li>
  )
}

export function FoundRow(props: { asset: MissingAsset }) {
  const { asset } = props
  return (
    <li className={styles.row}>
      <span className={`${styles.mark} ${styles.found}`} title="Found">
        <Icon name="check" size="small" />
      </span>
      <span className={styles.name}>{asset.displayName}</span>{' '}
      <span className={styles.muted}>
        {KIND_WORDS[asset.kind]}, {LIBRARY_WORDS[asset.library]}
      </span>
    </li>
  )
}
