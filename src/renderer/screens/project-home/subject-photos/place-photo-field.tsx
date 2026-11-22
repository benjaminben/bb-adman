// "Place first photo" (spec/subject-photos.md; A-119; HOME-3b): one Switch for the whole form,
// under the subjects: the label, its InfoTip, the Switch at the row's end. It is
// placeSubjectPhoto. It keeps its old name "Start the ad with a subject photo placed"; its plain
// help sits in the InfoTip.
import { useId } from 'react'
import { InfoTip } from '@/renderer/ui/info-tip'
import layout from '@/renderer/ui/layout.module.css'
import styles from './subject-photos.module.css'

type Props = { checked: boolean; onChange: (checked: boolean) => void }

export function PlacePhotoField({ checked, onChange }: Props) {
  const id = useId()
  return (
    <div className={styles.place}>
      <label htmlFor={id}>Place first photo</label>
      <InfoTip about="Place first photo">
        Every photo guides the AI pictures either way. Ticked: the newest photo of the first subject
        that has one goes in the subject picture slot as it is. Not ticked: the slot starts empty.
        Any photo can be placed later.
      </InfoTip>
      <input
        id={id}
        type="checkbox"
        role="switch"
        className={`${layout.switch} ${styles.placeSwitch}`}
        checked={checked}
        aria-label="Start the ad with a subject photo placed"
        onChange={(e) => onChange(e.target.checked)}
      />
    </div>
  )
}
