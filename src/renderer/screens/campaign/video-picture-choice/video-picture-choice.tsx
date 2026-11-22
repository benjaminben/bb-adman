// The video card's picture choice (SPEC 14 1.60 CU-6b-R N-9, N-12 3 and 5): the project's
// reference pictures, the list the picture panel's picker shows, with one choice only and
// the card's own "Add pictures". The choice is the card's, apart from the picker's ticks. A
// picture that cannot be sent shows its reason and cannot be chosen. Names are drawn as text.
// SP-7 (A-120): when nothing is chosen at the first read, the first photo of the variant's
// subject that can be sent is chosen; an asset-library subject photo shows "Photo of".
// P7-22: a start that takes more than one picture (`most`) shows a box per picture, and the
// boxes not ticked are disabled once `most` are ticked.
import { useEffect, useId, useRef } from 'react'
import { assetUrl } from '@/renderer/ui/asset-url'
import {
  type Reference,
  useAddPictures,
  useReferences,
  whyNot,
} from '@/renderer/ui/reference-picker/reference-list'
import { photoOfLine, subjectPhotoIds } from '@/renderer/ui/reference-picker/reference-rows'
import { PICTURE_HINT } from '@/renderer/screens/campaign/video-start'
import layout from '@/renderer/ui/layout.module.css'
import styles from './video-picture-choice.module.css'

const usable = (rows: Reference[], id: string): boolean =>
  rows.some((a) => a.id === id && whyNot(a) === null)

// The choice with `id` ticked or not: one picture replaces the choice, more add up to `most`.
function toggled(chosen: readonly string[], id: string, most: number): string[] {
  if (chosen.includes(id)) return chosen.filter((c) => c !== id)
  if (most === 1) return [id]
  return chosen.length < most ? [...chosen, id] : [...chosen]
}

export function VideoPictureChoice(props: {
  projectId: string
  subjectId: string | undefined
  chosen: readonly string[]
  most: number
  onChoose: (assetIds: string[]) => void
}) {
  const { projectId, subjectId, chosen, most, onChoose } = props
  const many = most > 1
  const { list, read } = useReferences(projectId)
  const addPictures = useAddPictures(projectId, subjectId, read)
  const baseId = useId()
  const firstRead = useRef(true)

  useEffect(() => {
    void read()
  }, [read])

  useEffect(() => {
    if (list === null || !firstRead.current) return
    firstRead.current = false
    const first = subjectPhotoIds(list, subjectId === undefined ? [] : [subjectId])[0]
    if (chosen.length === 0 && first !== undefined) onChoose([first])
  }, [list, chosen, subjectId, onChoose])

  // A choice is kept only for a picture that is still in the list and can be sent.
  useEffect(() => {
    if (list === null || chosen.every((id) => usable(list, id))) return
    onChoose(chosen.filter((id) => usable(list, id)))
  }, [list, chosen, onChoose])

  async function add() {
    const done = await addPictures()
    const first = done?.added.find((id) => usable(done.rows, id) && !chosen.includes(id))
    if (first !== undefined) onChoose(toggled(chosen, first, most))
  }

  return (
    <section aria-label="Picture to start from" className={layout.field}>
      <h3 className={layout.label}>Picture to start from</h3>
      {list !== null && list.length === 0 && (
        <p className={layout.muted}>No reference pictures in this project yet.</p>
      )}
      {list !== null && list.length > 0 && (
        <ul className={`${layout.list} ${styles.pictures}`}>
          {list.map((asset, i) => {
            const reason = whyNot(asset)
            const reasonId = `${baseId}-why-${i}`
            const photoOf = photoOfLine(asset)
            const ticked = chosen.includes(asset.id)
            const full = many && !ticked && chosen.length >= most
            return (
              <li key={asset.id} className={`${layout.row} ${styles.picture}`}>
                <label className={layout.row}>
                  <input
                    type={many ? 'checkbox' : 'radio'}
                    name={`${baseId}-picture`}
                    checked={ticked}
                    disabled={reason !== null || full}
                    aria-describedby={reason === null ? undefined : reasonId}
                    onChange={() => onChoose(toggled(chosen, asset.id, most))}
                  />
                  <img
                    className={styles.thumb}
                    src={assetUrl(projectId, asset.id)}
                    alt=""
                    width={48}
                    height={48}
                  />
                  {asset.displayName}
                </label>
                {photoOf !== null && <span className={layout.muted}>{photoOf}</span>}
                {reason !== null && (
                  <span id={reasonId} className={layout.muted}>
                    {reason}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <div className={layout.row}>
        <button type="button" onClick={() => void add()}>
          Add pictures
        </button>
      </div>
      <p className={layout.muted}>{PICTURE_HINT}</p>
    </section>
  )
}
