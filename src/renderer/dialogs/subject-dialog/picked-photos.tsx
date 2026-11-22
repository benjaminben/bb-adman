// R2C-6 (spec/phases/round-2-campaign.md, design addition 5, "The subject dialog", New): the
// "Photos" part. The picked files show by base name only (pictureName); their paths stay in
// the dialog's state until Create sends them to asset.import. DLG-3b: the hint is an InfoTip
// "About Photos" beside the group's label.
import { useId, type Ref } from 'react'
import { Icon } from '@/renderer/ui/icon'
import { InfoTip } from '@/renderer/ui/info-tip'
import layout from '@/renderer/ui/layout.module.css'
import { pictureName } from '@/shared/brief/picture-name'
import styles from './subject-dialog.module.css'

export type PickedPhotosProps = {
  paths: string[]
  disabled: boolean
  ref: Ref<HTMLButtonElement>
  onAdd: () => void
  onRemove: (index: number) => void
}

export function PickedPhotos({ paths, disabled, ref, onAdd, onRemove }: PickedPhotosProps) {
  const labelId = useId()
  return (
    <fieldset className={styles.photos} disabled={disabled} aria-labelledby={labelId}>
      <div className={styles.photosHead}>
        <span id={labelId} className={layout.label}>
          Photos
        </span>
        <InfoTip about="Photos">
          PNG, JPEG or WebP. At least one is needed. AI pictures are drawn from them.
        </InfoTip>
      </div>
      {paths.length > 0 && (
        <ul className={styles.picked} aria-label="Photos to add">
          {paths.map((path, i) => {
            const name = pictureName(path)
            return (
              <li key={i} className={styles.pickedRow}>
                <span className={styles.pickedName}>{name}</span>
                <button
                  type="button"
                  className={`${layout.quiet} ${layout.iconOnly} ${layout.small}`}
                  aria-label={`Remove ${name}`}
                  onClick={() => onRemove(i)}
                >
                  <Icon name="x" size="small" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <div>
        <button ref={ref} type="button" onClick={onAdd}>
          Add photos…
        </button>
      </div>
    </fieldset>
  )
}
