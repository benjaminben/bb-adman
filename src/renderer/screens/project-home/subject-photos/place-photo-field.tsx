// "Start the ad with a subject photo placed" (spec/subject-photos.md; A-119): one box for the
// whole form, under the subject list, with its hint. It is placeSubjectPhoto.
import { useId } from 'react'
import styles from './subject-photos.module.css'

type Props = { checked: boolean; onChange: (checked: boolean) => void }

export function PlacePhotoField({ checked, onChange }: Props) {
  const id = useId()
  return (
    <div className={styles.place}>
      <label>
        <input
          type="checkbox"
          checked={checked}
          aria-describedby={`${id}-hint`}
          onChange={(e) => onChange(e.target.checked)}
        />
        Start the ad with a subject photo placed
      </label>
      <p id={`${id}-hint`} className={styles.muted}>
        Every photo guides the AI pictures either way. Ticked: the newest photo of the first subject
        that has one goes in the subject picture slot as it is. Not ticked: the slot starts empty.
        Any photo can be placed later.
      </p>
    </div>
  )
}
