// "Required files" of the Rules section: one tile per required file (a picture's thumbnail, a
// font as an "Aa" tile), named by its display name only, with a ✕ "Remove {name}"; then a
// dashed "+" tile "Add a required file…", which opens a list of the project's pictures and
// fonts not yet required, a tick each, and "Add". No path is drawn.
import { useState } from 'react'
import { assetUrl } from '@/renderer/ui/asset-url'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import type { AssetList } from '@/shared/schemas/queries/asset'
import { AddFilesDialog } from './add-files-dialog'
import { Refusal, RuleGroup } from './rule-group'
import { useProjectAssets } from './use-rule-set'
import styles from './rule-set-panel.module.css'

const UNKNOWN = 'A file no longer in this project'

type Asset = AssetList[number]

function Face(props: { projectId: string; asset: Asset | undefined; name: string }) {
  const { asset } = props
  if (asset?.kind === 'image' && !asset.missing) {
    return (
      <img className={styles.picture} src={assetUrl(props.projectId, asset.id)} alt={props.name} />
    )
  }
  return (
    <>
      <span className={styles.face} aria-hidden="true">
        {asset?.kind === 'font' ? 'Aa' : <Icon name="file" />}
      </span>
      <span className={styles.hidden}>{props.name}</span>
    </>
  )
}

function Tiles(props: {
  projectId: string
  ids: string[]
  assets: AssetList | null
  onSave: (ids: string[]) => void
  onAdd: () => void
}) {
  const byId = new Map((props.assets ?? []).map((a) => [a.id, a]))
  return (
    <ul className={`${layout.list} ${styles.tiles}`} aria-label="Files">
      {props.assets !== null &&
        props.ids.map((id, i) => {
          const asset = byId.get(id)
          const name = asset?.displayName ?? UNKNOWN
          return (
            <li key={`${i}-${id}`} className={styles.tile} title={name}>
              <Face projectId={props.projectId} asset={asset} name={name} />
              <button
                type="button"
                className={`${layout.iconButton} ${styles.remove}`}
                aria-label={`Remove ${name}`}
                title={`Remove ${name}`}
                onClick={() => props.onSave(props.ids.filter((_, j) => j !== i))}
              >
                <Icon name="x" />
              </button>
            </li>
          )
        })}
      <li>
        <button
          type="button"
          className={`${layout.empty} ${styles.addTile}`}
          aria-label="Add a required file…"
          title="Add a required file…"
          onClick={props.onAdd}
        >
          <Icon name="plus" />
        </button>
      </li>
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
      <Tiles
        projectId={props.projectId}
        ids={ids}
        assets={assets}
        onSave={props.onSave}
        onAdd={() => setOpen(true)}
      />
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
