// P7-20 (spec/phases/phase-07-slices-2.md): "Add clip…" on the background row opens the list
// of the asset library's pictures and MP4 and MOV videos under the row; choosing one adds it at
// the first free place (clip.add without startMs) and closes the list. "Import…" brings files
// in through the import flow. The list stands under the row, not over it, since the timeline
// scrolls and would cut a pop-up off. The button is a "+" with the full name, so the row's
// narrow name column keeps "Background" readable.
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import { useClipAssets } from './use-clip-assets'
import styles from './add-clip.module.css'

export type AddClipButtonProps = { open: boolean; listId: string; onToggle: () => void }

const NAME = 'Add clip…'

export function AddClipButton({ open, listId, onToggle }: AddClipButtonProps) {
  return (
    <button
      type="button"
      className={`${layout.quiet} ${layout.small} ${layout.iconOnly}`}
      aria-label={NAME}
      title={NAME}
      aria-expanded={open}
      aria-controls={open ? listId : undefined}
      onClick={onToggle}
    >
      <Icon name="plus" size="small" />
    </button>
  )
}

export type AddClipListProps = {
  projectId: string
  variantId: string
  listId: string
  onRefusal: (message: string | null) => void
  onClose: () => void
}

export function AddClipList(props: AddClipListProps) {
  const { assets, importFiles, addClip } = useClipAssets(props.projectId, props.onRefusal)

  function choose(assetId: string) {
    props.onClose()
    void addClip(props.variantId, assetId)
  }

  return (
    <div
      id={props.listId}
      className={styles.panel}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        event.preventDefault()
        props.onClose()
      }}
    >
      {assets && assets.length === 0 && (
        <p className={styles.none}>No pictures or videos in the assets library yet.</p>
      )}
      {assets && assets.length > 0 && (
        <ul className={styles.list} aria-label="Pictures and videos">
          {assets.map((asset) => (
            <li key={asset.id}>
              <button
                type="button"
                className={`${layout.small} ${styles.choice}`}
                onClick={() => choose(asset.id)}
              >
                {asset.displayName}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className={`${layout.quiet} ${layout.small}`}
        onClick={() => void importFiles()}
      >
        Import…
      </button>
    </div>
  )
}
