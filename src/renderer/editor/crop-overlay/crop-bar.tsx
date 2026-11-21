// spec/editor.md, "Crop mode": the strip over the canvas while cropping, with how to use the
// keys, "Done" (applies the crop) and "Cancel" (leaves it unchanged). It sits outside the
// canvas so it never covers the crop's handles.
import styles from './crop-overlay.module.css'

export type CropBarProps = {
  layerName: string
  hintId: string
  // False until the picture has loaded and the crop is known.
  ready: boolean
  onDone: () => void
  onCancel: () => void
}

export function CropBar({ layerName, hintId, ready, onDone, onCancel }: CropBarProps) {
  return (
    <div className={styles.bar}>
      <p className={styles.title}>Crop {layerName}</p>
      <p id={hintId} className={styles.hint}>
        Drag or use the arrows to move the crop. Shift and the arrows resize it.
      </p>
      <div className={styles.actions}>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" disabled={!ready} onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  )
}
