// Reference pictures in the picture panel (SPEC 14 1.46 TP-5): the project's reference
// pictures with tick boxes, and "Add pictures" through the system picker and asset.import.
// The ticks belong to the campaign page, so they last while it is open. The screen draws no
// path and reads no file; a path goes only from the system picker to asset.import. The list
// and "Add pictures" are in reference-list.ts, shared with the video card (1.60 N-9).
// P4-13: moved to ui/ for the reference dialog, which shows two pickers over one ordered list
// of ticks: `library: 'asset'` lists the pictures made in the project (A-68), and `shared`
// leaves the other list's ticks alone and lets the dialog draw the one limit line.
// SP-7: an asset-library subject photo shows "Photo of {subject id}" after its name.
import { useCallback, useEffect, useId } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { assetUrl } from '@/renderer/ui/asset-url'
import { MAX_REFERENCES_PER_RUN } from '@/shared/config/defaults'
import { tooManyReferencesLine } from '@/shared/schemas/reference-ids'
import { type Reference, useAddPictures, whyNot } from './reference-list'
import layout from '@/renderer/ui/layout.module.css'
import { photoOfLine } from './reference-rows'
import { type PictureLibrary, usePictureList } from './use-picture-list'
import styles from './reference-picker.module.css'

const LOCAL_LINE =
  "ComfyUI takes one reference picture for now and makes the result in that picture's shape, at about 1 megapixel."

const WORDS: Record<PictureLibrary, { heading: string; empty: string }> = {
  reference: {
    heading: 'Reference pictures',
    empty: 'No reference pictures in this project yet.',
  },
  asset: { heading: 'Made in this project', empty: 'No pictures made in this project yet.' },
}

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
  // Ticks shared with another list; the owner draws the limit line under `fullNoteId`.
  shared?: { fullNoteId: string }
}) {
  const { projectId, subjectId, ticks, setTicks } = props
  const library = props.library ?? 'reference'
  const shared = props.shared !== undefined
  const { list, read } = usePictureList(projectId, library)
  const addPictures = useAddPictures(projectId, subjectId, read)
  const baseId = useId()
  const fullId = props.shared?.fullNoteId ?? `${baseId}-full`
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

  return (
    <section aria-label={WORDS[library].heading} className={layout.field}>
      <h3 className={layout.label}>{WORDS[library].heading}</h3>
      {list !== null && list.length === 0 && <p className={layout.muted}>{WORDS[library].empty}</p>}
      {list !== null && list.length > 0 && (
        <ul className={`${layout.list} ${styles.grid}`}>
          {list.map((asset, i) => {
            const reason = whyNot(asset)
            const place = ticks.indexOf(asset.id) + 1
            const reasonId = `${baseId}-why-${i}`
            const photoOf = photoOfLine(asset)
            return (
              <li key={asset.id} className={styles.tile}>
                <label className={styles.pick}>
                  <input
                    type="checkbox"
                    checked={place > 0}
                    disabled={reason !== null || (full && place === 0)}
                    aria-describedby={
                      reason !== null ? reasonId : full && place === 0 ? fullId : undefined
                    }
                    onChange={() => toggle(asset.id)}
                  />
                  <img
                    className={styles.thumb}
                    src={assetUrl(projectId, asset.id)}
                    alt=""
                    width={48}
                    height={48}
                  />
                  <span className={styles.name}>{asset.displayName}</span>
                </label>
                {photoOf !== null && <span className={styles.note}>{photoOf}</span>}
                {place > 0 && <span className={styles.place}>{place}</span>}
                {reason !== null && (
                  <span id={reasonId} className={styles.note}>
                    {reason}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {full && !shared && (
        <p id={fullId} className={layout.muted}>
          {tooManyReferencesLine}
        </p>
      )}
      {props.local && ticks.length > 0 && <p className={layout.muted}>{LOCAL_LINE}</p>}
      {library === 'reference' && (
        <div className={layout.row}>
          <button type="button" onClick={() => void add()}>
            Add pictures
          </button>
        </div>
      )}
    </section>
  )
}
