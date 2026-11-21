// One missing asset: its name, its kind and library as words, and its "Find…" button.
import type { MissingAsset } from './use-missing-assets'
import styles from './relink-dialog.module.css'

const KIND_WORDS: Record<MissingAsset['kind'], string> = {
  image: 'picture',
  video: 'video',
  font: 'font',
  text: 'text file',
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
      <span className={styles.name}>{asset.displayName}</span>{' '}
      <span className={styles.muted}>
        {KIND_WORDS[asset.kind]}, {LIBRARY_WORDS[asset.library]}
      </span>{' '}
      <button
        type="button"
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
