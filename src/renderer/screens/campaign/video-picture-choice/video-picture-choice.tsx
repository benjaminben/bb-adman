// The video card's picture choice (SPEC 14 1.60 CU-6b-R N-9, N-12 3 and 5): the project's
// reference pictures, the list the picture panel's picker shows, with one choice only and
// the card's own "Add pictures". The choice is the card's, apart from the picker's ticks. A
// picture that cannot be sent shows its reason and cannot be chosen. Names are drawn as text.
import { useEffect, useId } from 'react'
import { assetUrl } from '@/renderer/ui/asset-url'
import {
  type Reference,
  useAddPictures,
  useReferences,
  whyNot,
} from '@/renderer/ui/reference-picker/reference-list'
import { PICTURE_HINT } from '@/renderer/screens/campaign/video-start'
import layout from '@/renderer/ui/layout.module.css'

const usable = (rows: Reference[], id: string | null): boolean =>
  rows.some((a) => a.id === id && whyNot(a) === null)

export function VideoPictureChoice(props: {
  projectId: string
  subjectId: string | undefined
  chosen: string | null
  onChoose: (assetId: string | null) => void
}) {
  const { projectId, subjectId, chosen, onChoose } = props
  const { list, read } = useReferences(projectId)
  const addPictures = useAddPictures(projectId, subjectId, read)
  const baseId = useId()

  useEffect(() => {
    void read()
  }, [read])

  // A choice is kept only for a picture that is still in the list and can be sent.
  useEffect(() => {
    if (list !== null && chosen !== null && !usable(list, chosen)) onChoose(null)
  }, [list, chosen, onChoose])

  async function add() {
    const done = await addPictures()
    const first = done?.added.find((id) => usable(done.rows, id))
    if (first !== undefined) onChoose(first)
  }

  return (
    <section aria-label="Picture to start from" className={layout.field}>
      <h3 className={layout.label}>Picture to start from</h3>
      {list !== null && list.length === 0 && (
        <p className={layout.muted}>No reference pictures in this project yet.</p>
      )}
      {list !== null && list.length > 0 && (
        <ul className={layout.list}>
          {list.map((asset, i) => {
            const reason = whyNot(asset)
            const reasonId = `${baseId}-why-${i}`
            return (
              <li key={asset.id} className={layout.row}>
                <label className={layout.row}>
                  <input
                    type="radio"
                    name={`${baseId}-picture`}
                    checked={asset.id === chosen}
                    disabled={reason !== null}
                    aria-describedby={reason === null ? undefined : reasonId}
                    onChange={() => onChoose(asset.id)}
                  />
                  <img src={assetUrl(projectId, asset.id)} alt="" width={48} height={48} />
                  {asset.displayName}
                </label>
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
