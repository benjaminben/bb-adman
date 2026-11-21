// "Required files" of the rule set panel: each asset's name with "Remove", and "Add a required
// file…", which opens a list of the project's pictures and fonts not yet required, a tick each,
// and "Add".
import { useState } from 'react'
import layout from '@/renderer/ui/layout.module.css'
import type { AssetList } from '@/shared/schemas/queries/asset'
import { AddFilesDialog } from './add-files-dialog'
import { Refusal, RuleGroup } from './rule-group'
import { useProjectAssets } from './use-rule-set'
import styles from './rule-set-panel.module.css'

const UNKNOWN = 'A file no longer in this project'

function Items(props: { ids: string[]; assets: AssetList; onSave: (ids: string[]) => void }) {
  const names = new Map(props.assets.map((a) => [a.id, a.displayName]))
  return (
    <ul className={`${layout.list} ${styles.items}`}>
      {props.ids.map((id, i) => {
        const name = names.get(id) ?? UNKNOWN
        return (
          <li key={`${i}-${id}`} className={styles.item}>
            <span>{name}</span>
            <button
              type="button"
              className={`${layout.quiet} ${layout.small}`}
              aria-label={`Remove ${name}`}
              onClick={() => props.onSave(props.ids.filter((_, j) => j !== i))}
            >
              Remove
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export function RequiredFiles(props: {
  projectId: string
  ids: string[]
  refusal: string | undefined
  onSave: (ids: string[]) => void
}) {
  const { ids } = props
  const [open, setOpen] = useState(false)
  const assets = useProjectAssets(props.projectId, open || ids.length > 0)
  const files = (assets ?? []).filter((a) => a.kind === 'image' || a.kind === 'font')
  const choices = files.filter((a) => !ids.includes(a.id))

  return (
    <RuleGroup title="Required files">
      {ids.length === 0 ? (
        <p className={layout.muted}>No required files.</p>
      ) : assets === null ? (
        <p className={layout.muted}>Loading the files…</p>
      ) : (
        <Items ids={ids} assets={assets} onSave={props.onSave} />
      )}
      <div className={layout.row}>
        <button type="button" onClick={() => setOpen(true)}>
          Add a required file…
        </button>
      </div>
      <Refusal message={props.refusal} />
      {open && (
        <AddFilesDialog
          choices={assets === null ? null : choices}
          none={files.length === 0}
          onClose={() => setOpen(false)}
          onAdd={(picked) => {
            setOpen(false)
            props.onSave([...ids, ...picked])
          }}
        />
      )}
    </RuleGroup>
  )
}
