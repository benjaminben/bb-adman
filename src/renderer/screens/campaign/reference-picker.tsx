// Reference pictures in the picture panel (SPEC 14 1.46 TP-5): the project's reference
// pictures with tick boxes, and "Add pictures" through the system picker and asset.import.
// The ticks belong to the campaign page, so they last while it is open. The screen draws no
// path and reads no file; a path goes only from the system picker to asset.import.
import { useCallback, useEffect, useId, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useApi, useApp } from '../../app/app-context'
import type { AssetList } from '../../../shared/schemas/queries/asset'
import type { PickedPaths } from '../../../shared/schemas/queries/dialog'
import { assetUrl } from '../../ui/asset-url'
import styles from '../screens.module.css'

type Reference = AssetList[number]
type ImportReply = { assetIds: string[] }

const LOCAL_LINE =
  "ComfyUI takes one reference picture for now and makes the result in that picture's shape, at about 1 megapixel."

function whyNot(asset: Reference): string | null {
  if (asset.missing) return 'file not found'
  if (asset.mime === 'image/webp') return 'WebP cannot be sent yet'
  return null
}

function tickable(list: Reference[]): Set<string> {
  return new Set(list.filter((a) => whyNot(a) === null).map((a) => a.id))
}

function useReferences(projectId: string) {
  const api = useApi()
  const [list, setList] = useState<Reference[] | null>(null)
  const read = useCallback(async () => {
    const result = await api.query('asset.list', { projectId, library: 'reference', kind: 'image' })
    const rows = result.ok ? ((result.data as AssetList | null) ?? []) : []
    setList(rows)
    return rows
  }, [api, projectId])
  return { list, read }
}

export function ReferencePicker(props: {
  projectId: string
  subjectId: string | undefined
  local: boolean
  ticks: string[]
  setTicks: Dispatch<SetStateAction<string[]>>
}) {
  const { projectId, subjectId, ticks, setTicks } = props
  const api = useApi()
  const command = useApp((s) => s.command)
  const { list, read } = useReferences(projectId)
  const baseId = useId()

  // A tick is kept only for an asset that is still in the list and can be sent.
  const keepKnown = useCallback(
    (rows: Reference[], added: string[] = []) => {
      const ok = tickable(rows)
      setTicks((t) => [...t, ...added.filter((id) => !t.includes(id))].filter((id) => ok.has(id)))
    },
    [setTicks],
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
    const picked = await api.query('dialog.pickFiles', {
      purpose: 'import',
      kind: 'image',
      multiple: true,
    })
    const paths = picked.ok ? ((picked.data as PickedPaths | null)?.paths ?? []) : []
    if (paths.length === 0) return
    const result = await command('asset.import', {
      projectId,
      paths,
      library: 'reference',
      copy: false,
      ...(subjectId === undefined ? {} : { subjectId }),
    })
    if (!result.ok) return
    const rows = await read()
    keepKnown(rows, [...new Set((result.data as ImportReply | null)?.assetIds ?? [])])
  }

  function toggle(id: string) {
    setTicks((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]))
  }

  return (
    <section aria-label="Reference pictures" className={styles.field}>
      <h3 className={styles.label}>Reference pictures</h3>
      {list !== null && list.length === 0 && (
        <p className={styles.muted}>No reference pictures in this project yet.</p>
      )}
      {list !== null && list.length > 0 && (
        <ul className={styles.list}>
          {list.map((asset, i) => {
            const reason = whyNot(asset)
            const place = ticks.indexOf(asset.id) + 1
            const reasonId = `${baseId}-why-${i}`
            return (
              <li key={asset.id} className={styles.row}>
                <label className={styles.row}>
                  <input
                    type="checkbox"
                    checked={place > 0}
                    disabled={reason !== null}
                    aria-describedby={reason === null ? undefined : reasonId}
                    onChange={() => toggle(asset.id)}
                  />
                  <img src={assetUrl(projectId, asset.id)} alt="" width={48} height={48} />
                  {asset.displayName}
                </label>
                {place > 0 && <span>{place}</span>}
                {reason !== null && (
                  <span id={reasonId} className={styles.muted}>
                    {reason}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {props.local && ticks.length > 0 && <p className={styles.muted}>{LOCAL_LINE}</p>}
      <div className={styles.row}>
        <button type="button" onClick={() => void add()}>
          Add pictures
        </button>
      </div>
    </section>
  )
}
