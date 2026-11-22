// "Another picture of the same shape…" (spec/phases/round-2-editor.md D4, "Same shape"): the
// project's images of either library that can be sent and have the layer box's shape, the
// layer's own picture left out, one to choose, named by display name. "Add pictures…" imports
// through the system picker as the video card's picture choice does; an added picture of this
// shape is chosen, one of another shape is named in a line. No path is drawn here.
import { useState } from 'react'
import { assetUrl } from '@/renderer/ui/asset-url'
import { useAddPictures } from '@/renderer/ui/reference-picker/reference-list'
import { sameShape, type Size } from '@/shared/generation/same-shape'
import type { AssetList } from '@/shared/schemas/queries/asset'
import layout from '@/renderer/ui/layout.module.css'
import styles from './generate-panel.module.css'

type Row = AssetList[number]

export type ShapeFilter = { box: Size; ownId: string | null }

// The pictures a start of the same shape may be.
export const shaped = (rows: readonly Row[], filter: ShapeFilter): Row[] =>
  rows.filter((a) => !a.missing && a.id !== filter.ownId && sameShape(filter.box, a))

export type SameShapeListProps = ShapeFilter & {
  projectId: string
  images: AssetList | null
  read: () => Promise<AssetList>
  chosen: string | null
  disabled: boolean
  name: string
  onChoose: (assetId: string) => void
}

export function SameShapeList(props: SameShapeListProps) {
  const { projectId, box, chosen, onChoose } = props
  const addPictures = useAddPictures(projectId, undefined, props.read)
  const [others, setOthers] = useState<string[]>([])
  const list = props.images === null ? null : shaped(props.images, props)

  async function add() {
    const done = await addPictures()
    if (done === null) return
    const added = done.rows.filter((a) => done.added.includes(a.id))
    const fits = shaped(added, props)
    const first = fits[0]
    if (first !== undefined) onChoose(first.id)
    setOthers(added.filter((a) => !fits.includes(a)).map((a) => a.displayName))
  }

  return (
    <section aria-label="Pictures of the same shape" className={layout.field}>
      {list !== null && list.length === 0 && (
        <p className={layout.muted}>
          {`No other picture in this project has this layer's shape (${Math.round(box.width ?? 0)} × ${Math.round(box.height ?? 0)}).`}
        </p>
      )}
      {list !== null && list.length > 0 && (
        <ul className={`${layout.list} ${styles.grid}`}>
          {list.map((asset) => (
            <li key={asset.id} className={styles.tile}>
              <label className={styles.pick}>
                <input
                  type="radio"
                  name={props.name}
                  checked={chosen === asset.id}
                  disabled={props.disabled}
                  onChange={() => onChoose(asset.id)}
                />
                <img className={styles.thumb} src={assetUrl(projectId, asset.id)} alt="" />
                <span className={styles.name}>{asset.displayName}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {others.map((name) => (
        <p key={name} className={layout.muted}>
          {`${name} has another shape, so it is not listed.`}
        </p>
      ))}
      <div className={layout.row}>
        <button type="button" disabled={props.disabled} onClick={() => void add()}>
          Add pictures…
        </button>
      </div>
    </section>
  )
}
