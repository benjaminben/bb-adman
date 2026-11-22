// Reference pictures in the picture panel (SPEC 14 1.46 TP-5): the project's reference
// pictures with tick boxes, and "Add pictures" through the system picker and asset.import.
// The ticks belong to the campaign page, so they last while it is open. The screen draws no
// path and reads no file; a path goes only from the system picker to asset.import. The list
// and "Add pictures" are in reference-list.ts, shared with the video card (1.60 N-9).
// P4-13: moved to ui/ for the reference dialog, which shows two pickers over one ordered list
// of ticks: `library: 'asset'` lists the pictures made in the project (A-68), and `shared`
// leaves the other list's ticks alone and lets the dialog draw the one limit line.
// SP-7: an asset-library subject photo shows "Photo of {subject id}" after its name.
// DLG-5 (C-16): the pictures are a pickGrid of tiles with no caption. Each tick box is named by
// the display name, and the tile's `title` holds the name, "Photo of {subject}" and, at the
// limit, why it cannot be ticked. The heading reads "Library" or "Made here"; the region keeps
// its old name. A ticked tile shows its place in the order. "Add pictures" is a dashed "+" tile
// at the end of the reference pictures.
import { useCallback, useEffect, useId } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { assetUrl } from '@/renderer/ui/asset-url'
import { dialogStyles } from '@/renderer/ui/dialog-frame'
import { Icon } from '@/renderer/ui/icon'
import { MAX_REFERENCES_PER_RUN } from '@/shared/config/defaults'
import { tooManyReferencesLine } from '@/shared/schemas/reference-ids'
import { type Reference, useAddPictures, whyNot } from './reference-list'
import layout from '@/renderer/ui/layout.module.css'
import { photoOfLine } from './reference-rows'
import { type PictureLibrary, usePictureList } from './use-picture-list'
import styles from './reference-picker.module.css'

const LOCAL_LINE =
  "ComfyUI takes one reference picture for now and makes the result in that picture's shape, at about 1 megapixel."

const WORDS: Record<PictureLibrary, { name: string; heading: string; empty: string }> = {
  reference: {
    name: 'Reference pictures',
    heading: 'Library',
    empty: 'No reference pictures in this project yet.',
  },
  asset: {
    name: 'Made in this project',
    heading: 'Made here',
    empty: 'No pictures made in this project yet.',
  },
}

const LIMIT_REASON = `At most ${MAX_REFERENCES_PER_RUN} pictures`

// The IDs a tick may stay on after a read. A shared picker drops only its own rows that
// cannot be sent; the other list's ticks are not its to drop.
function keeper(rows: Reference[], shared: boolean): (id: string) => boolean {
  const ok = new Set(rows.filter((a) => whyNot(a) === null).map((a) => a.id))
  const own = new Set(rows.map((a) => a.id))
  return shared ? (id) => ok.has(id) || !own.has(id) : (id) => ok.has(id)
}

export function ReferencePicker(props: {
  projectId: string
  subjectId: string | undefined
  local: boolean
  ticks: string[]
  setTicks: Dispatch<SetStateAction<string[]>>
  library?: PictureLibrary
  // Ticks shared with another list: the owner shows the count, and the limit is said on each
  // tile that cannot be ticked.
  shared?: boolean
}) {
  const { projectId, subjectId, ticks, setTicks } = props
  const library = props.library ?? 'reference'
  const shared = props.shared === true
  const { list, read } = usePictureList(projectId, library)
  const addPictures = useAddPictures(projectId, subjectId, read)
  const baseId = useId()
  const fullId = `${baseId}-full`
  // F-8 [A-56]: at the limit, an unticked picture cannot be ticked.
  const full = ticks.length >= MAX_REFERENCES_PER_RUN

  // A tick is kept only for an asset that is still in the list and can be sent.
  const keepKnown = useCallback(
    (rows: Reference[], added: string[] = []) => {
      const keep = keeper(rows, shared)
      setTicks((t) => [...t, ...added.filter((id) => !t.includes(id))].filter(keep))
    },
    [setTicks, shared],
  )

  useEffect(() => {
    let live = true
    void read().then((rows) => {
      if (live) keepKnown(rows)
    })
    return () => {
      live = false
    }
  }, [read, keepKnown])

  async function add() {
    const done = await addPictures()
    if (done !== null) keepKnown(done.rows, done.added)
  }

  function toggle(id: string) {
    setTicks((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]))
  }

  const words = WORDS[library]
  const rows = list ?? []
  return (
    <section aria-label={words.name} className={layout.field}>
      <h3 className={layout.label}>{words.heading}</h3>
      {list !== null && list.length === 0 && <p className={layout.muted}>{words.empty}</p>}
      {(rows.length > 0 || library === 'reference') && (
        <ul className={`${layout.list} ${dialogStyles.pickGrid} ${styles.grid}`}>
          {rows.map((asset, i) => {
            const reason = whyNot(asset)
            const place = ticks.indexOf(asset.id) + 1
            const atLimit = reason === null && full && place === 0
            const reasonId = `${baseId}-why-${i}`
            const photoOf = photoOfLine(asset)
            const title = [asset.displayName, photoOf, atLimit && shared ? LIMIT_REASON : null]
            return (
              <li key={asset.id} className={styles.tile}>
                <label className={styles.pick} title={title.filter(Boolean).join(' · ')}>
                  <input
                    type="checkbox"
                    checked={place > 0}
                    disabled={reason !== null || atLimit}
                    aria-describedby={reason !== null ? reasonId : atLimit ? fullId : undefined}
                    onChange={() => toggle(asset.id)}
                  />
                  <img
                    className={styles.thumb}
                    src={assetUrl(projectId, asset.id)}
                    alt=""
                    width={48}
                    height={48}
                  />
                  <span className={styles.hidden}>{asset.displayName}</span>
                </label>
                {photoOf !== null && <span className={styles.hidden}>{photoOf}</span>}
                {place > 0 && <span className={styles.place}>{place}</span>}
                {reason !== null && (
                  <span id={reasonId} className={styles.note}>
                    {reason}
                  </span>
                )}
              </li>
            )
          })}
          {library === 'reference' && (
            <li className={styles.tile}>
              <button
                type="button"
                className={styles.add}
                aria-label="Add pictures"
                title="Add pictures"
                onClick={() => void add()}
              >
                <Icon name="plus" />
              </button>
            </li>
          )}
        </ul>
      )}
      {full && shared && (
        <span id={fullId} className={styles.hidden}>
          {LIMIT_REASON}
        </span>
      )}
      {full && !shared && (
        <p id={fullId} className={layout.muted}>
          {tooManyReferencesLine}
        </p>
      )}
      {props.local && ticks.length > 0 && <p className={layout.muted}>{LOCAL_LINE}</p>}
    </section>
  )
}
