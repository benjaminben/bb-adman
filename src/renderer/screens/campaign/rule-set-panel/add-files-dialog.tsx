// The list "Add a required file…" opens: the project's pictures and fonts not yet required, a
// tick each, and "Add", which sends the ticked ones in the order listed. Null while the
// project's files are being read.
import { useState } from 'react'
import { DialogFrame } from '@/renderer/ui/dialog-frame'
import layout from '@/renderer/ui/layout.module.css'
import type { AssetList } from '@/shared/schemas/queries/asset'
import styles from './rule-set-panel.module.css'

const KIND: Record<string, string> = { image: 'Picture', font: 'Font' }

export function AddFilesDialog(props: {
  choices: AssetList | null
  none: boolean
  onClose: () => void
  onAdd: (ids: string[]) => void
}) {
  const [ticked, setTicked] = useState<string[]>([])
  const toggle = (id: string, on: boolean) =>
    setTicked((now) => (on ? [...now, id] : now.filter((t) => t !== id)))
  const picked = (props.choices ?? []).map((a) => a.id).filter((id) => ticked.includes(id))

  const footer = (
    <>
      <button type="button" className={layout.quiet} onClick={props.onClose}>
        Cancel
      </button>
      <button
        type="button"
        className={layout.primary}
        disabled={picked.length === 0}
        onClick={() => props.onAdd(picked)}
      >
        Add
      </button>
    </>
  )

  return (
    <DialogFrame open onClose={props.onClose} title="Add a required file" footer={footer}>
      {props.choices === null ? (
        <p className={layout.muted}>Loading the files…</p>
      ) : props.choices.length === 0 ? (
        <p className={layout.muted}>
          {props.none
            ? 'This project has no pictures or fonts.'
            : 'Every picture and font of this project is already required.'}
        </p>
      ) : (
        <ul className={`${layout.list} ${styles.ticks}`} aria-label="Pictures and fonts">
          {props.choices.map((a) => (
            <li key={a.id}>
              <label>
                <input
                  type="checkbox"
                  checked={ticked.includes(a.id)}
                  onChange={(e) => toggle(a.id, e.target.checked)}
                />
                {a.displayName}
                <span className={layout.muted}>{KIND[a.kind]}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </DialogFrame>
  )
}
