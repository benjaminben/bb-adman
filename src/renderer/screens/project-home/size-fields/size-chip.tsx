// One size on the brief form (HOME-3a): a pill holding the size's shape and label, and, while
// it is chosen, a ★ that makes it the master. A ready-made size's face is a toggle button named
// "1x1 (1080×1080)"; a typed size's face is plain text (it is removed by editing the field).
// The pixels are the face's `title`.
import type { CampaignSize } from '@/shared/schemas/commands/campaign'
import { Icon } from '@/renderer/ui/icon'
import styles from './size-fields.module.css'

type Props = {
  size: CampaignSize
  chosen: boolean
  // A ready-made size: the face's name and what a click on it does.
  name?: string
  onToggle?: () => void
  // A chosen size: whether it is the master, and how to make it so.
  master?: boolean
  onMaster?: () => void
}

function Face(props: { size: CampaignSize }) {
  const { width, height } = props.size
  return (
    <>
      <span
        className={styles.shape}
        style={{ aspectRatio: `${width} / ${height}` }}
        aria-hidden="true"
      />
      {props.size.label}
    </>
  )
}

export function SizeChip(props: Props) {
  const { size } = props
  const pixels = `${size.width}×${size.height}`
  return (
    <span className={styles.chip} data-chosen={props.chosen}>
      {props.onToggle !== undefined ? (
        <button
          type="button"
          className={styles.face}
          aria-label={props.name}
          aria-pressed={props.chosen}
          title={pixels}
          onClick={props.onToggle}
        >
          <Face size={size} />
        </button>
      ) : (
        <span className={styles.face} title={pixels}>
          <Face size={size} />
        </span>
      )}
      {props.onMaster !== undefined && (
        <button
          type="button"
          className={styles.star}
          aria-label={`Master: ${size.label}`}
          aria-pressed={props.master === true}
          title={props.master === true ? 'Master' : 'Make master'}
          onClick={props.onMaster}
        >
          <Icon name="star" />
        </button>
      )}
    </span>
  )
}
