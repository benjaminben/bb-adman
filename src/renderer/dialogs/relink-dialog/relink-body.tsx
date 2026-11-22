// The relink dialog's content: the switch, the status line, the list of missing assets and
// "Close". "Find…" asks the system picker for a file of the asset's kind, then sends
// asset.relink. After each send the list is read again and focus moves on. DLG-7: the box is a
// Switch "Search folder" (its old sentence kept as its name, and in an InfoTip); the files
// found in this opening are listed under "Found".
import { useEffect, useRef, useState } from 'react'
import { useApi, useApp } from '@/renderer/app/app-context'
import type { PickedPaths } from '@/shared/schemas/queries/dialog'
import { BusySpinner, DialogFoot } from '@/renderer/ui/dialog-frame'
import { InfoTip } from '@/renderer/ui/info-tip'
import layout from '@/renderer/ui/layout.module.css'
import { plural } from '@/renderer/ui/plural'
import { FoundRow, MissingRow } from './missing-row'
import { useMissingAssets, type MissingAsset } from './use-missing-assets'
import styles from './relink-dialog.module.css'

export type RelinkBodyProps = {
  projectId: string
  onlyAssetIds?: string[]
  busy: boolean
  onBusy: (busy: boolean) => void
  onClose: () => void
}

type Status = { refused: boolean; text: string } | null
type Relinked = { assetId: string; siblingIds: string[] }

const SIBLINGS = 'Also look for other missing files in the same folder'

function foundText(name: string, siblings: number) {
  const were = siblings === 1 ? 'was' : 'were'
  const files = plural(siblings, 'other file')
  const more = siblings > 0 ? ` ${files} in the same folder ${were} found too.` : ''
  return `Found ${name}.${more}`
}

// The row after the relinked one that is still missing, else the first one left, else Close.
function nextFocus(before: MissingAsset[], after: MissingAsset[], assetId: string) {
  const left = new Set(after.map((a) => a.id))
  const start = before.findIndex((a) => a.id === assetId) + 1
  const next = before.slice(start).find((a) => left.has(a.id))
  return next?.id ?? after[0]?.id ?? 'close'
}

export function RelinkBody(props: RelinkBodyProps) {
  const { projectId, busy, onBusy } = props
  const api = useApi()
  const command = useApp((s) => s.command)
  const { assets, found, readError, read } = useMissingAssets(projectId, props.onlyAssetIds)
  const [siblings, setSiblings] = useState(true)
  const [findingId, setFindingId] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>(null)
  const list = useRef<HTMLUListElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const focusNext = useRef<string | null>(null)

  useEffect(() => {
    void read()
  }, [read])

  // Runs after the render that enables the buttons again.
  useEffect(() => {
    const id = focusNext.current
    if (id === null || busy) return
    focusNext.current = null
    const finds = [...(list.current?.querySelectorAll('button') ?? [])]
    const target =
      id === 'close' ? closeButton.current : finds.find((b) => b.dataset.assetId === id)
    target?.focus()
  })

  async function find(asset: MissingAsset) {
    const picked = await api.query('dialog.pickFiles', { purpose: 'relink', kind: asset.kind })
    const newPath = picked.ok ? (picked.data as PickedPaths | null)?.paths[0] : undefined
    if (newPath === undefined) return
    setFindingId(asset.id)
    onBusy(true)
    const input = { projectId, assetId: asset.id, newPath, relinkSiblings: siblings }
    const result = await command('asset.relink', input)
    const before = assets ?? []
    const after = await read()
    if (result.ok) {
      const reply = result.data as Relinked
      setStatus({ refused: false, text: foundText(asset.displayName, reply.siblingIds.length) })
      focusNext.current = nextFocus(before, after, asset.id)
    } else {
      setStatus({ refused: true, text: result.error.message })
      focusNext.current = asset.id
    }
    setFindingId(null)
    onBusy(false)
  }

  const message = readError ?? (status?.refused ? status.text : null)

  return (
    <>
      <fieldset className={styles.box} disabled={busy}>
        <label className={styles.switchLabel}>
          <input
            type="checkbox"
            role="switch"
            className={layout.switch}
            aria-label={SIBLINGS}
            checked={siblings}
            onChange={(e) => setSiblings(e.target.checked)}
          />
          Search folder
        </label>
        <InfoTip about="Search folder">{`${SIBLINGS}.`}</InfoTip>
      </fieldset>
      {message !== null && (
        <p role="alert" className={`${layout.notice} ${layout.danger} ${styles.line}`}>
          {message}
        </p>
      )}
      {status !== null && !status.refused && (
        <p role="status" className={`${layout.notice} ${layout.ok} ${styles.line}`}>
          {status.text}
        </p>
      )}
      {assets === null ? (
        <p className={styles.busy}>
          <BusySpinner />
          Looking for missing files…
        </p>
      ) : assets.length === 0 ? (
        <p className={styles.status}>No file is missing.</p>
      ) : (
        <ul ref={list} aria-label="Missing files" className={styles.list}>
          {assets.map((asset) => (
            <MissingRow
              key={asset.id}
              asset={asset}
              finding={findingId === asset.id}
              disabled={busy}
              onFind={() => void find(asset)}
            />
          ))}
        </ul>
      )}
      {found.length > 0 && (
        <>
          <h3 className={styles.heading}>Found</h3>
          <ul aria-label="Found" className={styles.list}>
            {found.map((asset) => (
              <FoundRow key={asset.id} asset={asset} />
            ))}
          </ul>
        </>
      )}
      <DialogFoot>
        <button type="button" ref={closeButton} disabled={busy} onClick={props.onClose}>
          Close
        </button>
      </DialogFoot>
    </>
  )
}
