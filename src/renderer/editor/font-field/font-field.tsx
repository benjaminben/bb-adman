// spec/editor.md, "Fonts: upload and choice" [REQ: FR-056, FR-093]: the "Font" select lists the
// default font, then every font of the asset library by its fontFamily (else its display name);
// a missing one says "(file not found)". "Upload font…" picks one font file through the system
// picker, imports it linked into the asset library and sets it as the font. A cancelled picker
// sends nothing; a refused import shows its message and changes nothing. Font names from a file
// are shown as text only. A path goes only from the picker to asset.import.
// ED-2: the select shows no title (its name stays "Font"); the default reads "Inter (default)";
// "Upload font…" is an icon button beside it, name unchanged. It tells the Type summary the name.
import { useCallback, useEffect, useId, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import type { AssetList } from '@/shared/schemas/queries/asset'
import type { PickedPaths } from '@/shared/schemas/queries/dialog'
import { useReportFontName } from './font-name'
import styles from './font-field.module.css'

export type FontFieldProps = {
  projectId: string
  fontAssetId: string | null
  disabled: boolean
  // Resolves to the refusal message, or null when the font was set.
  onChange: (fontAssetId: string | null) => Promise<string | null>
}

type ImportReply = { assetIds: string[] }

const nameOf = (asset: AssetList[number]) => asset.fontFamily ?? asset.displayName
const labelOf = (asset: AssetList[number]) =>
  `${nameOf(asset)}${asset.missing ? ' (file not found)' : ''}`
const UPLOAD = 'Upload font…'

export function FontField(props: FontFieldProps) {
  const { projectId } = props
  const api = useApi()
  const id = useId()
  const [fonts, setFonts] = useState<AssetList>([])
  const [error, setError] = useState<string | null>(null)

  const list = useCallback(async (): Promise<AssetList> => {
    const result = await api.query('asset.list', { projectId, library: 'asset', kind: 'font' })
    return result.ok ? ((result.data as AssetList | null) ?? []) : []
  }, [api, projectId])
  const read = async () => setFonts(await list())

  useEffect(() => {
    let live = true
    void list().then((rows) => live && setFonts(rows))
    return () => {
      live = false
    }
  }, [list])

  const choose = async (fontAssetId: string | null) => setError(await props.onChange(fontAssetId))

  async function upload() {
    const picked = await api.query('dialog.pickFiles', {
      purpose: 'import',
      kind: 'font',
      multiple: false,
    })
    const paths = picked.ok ? ((picked.data as PickedPaths | null)?.paths ?? []) : []
    if (paths.length === 0) return
    const result = await api.command('asset.import', {
      projectId,
      paths,
      library: 'asset',
      copy: false,
    })
    if (!result.ok) return setError(result.error.message)
    const added = (result.data as ImportReply | null)?.assetIds[0]
    if (!added) return
    await read()
    await choose(added)
  }

  const known = props.fontAssetId === null || fonts.some((f) => f.id === props.fontAssetId)
  const chosen = fonts.find((f) => f.id === props.fontAssetId)
  useReportFontName(props.fontAssetId === null ? 'Inter' : chosen ? nameOf(chosen) : null)

  return (
    <div className={styles.field}>
      <label className={styles.hidden} htmlFor={id}>
        Font
      </label>
      <div className={styles.row}>
        <select
          id={id}
          className={styles.select}
          aria-describedby={error ? `${id}-error` : undefined}
          disabled={props.disabled}
          value={props.fontAssetId ?? ''}
          onChange={(event) => void choose(event.target.value || null)}
        >
          <option value="">Inter (default)</option>
          {fonts.map((f) => (
            <option key={f.id} value={f.id}>
              {labelOf(f)}
            </option>
          ))}
          {!known && <option value={props.fontAssetId ?? ''}>Font not in the asset library</option>}
        </select>
        <button
          type="button"
          className={layout.iconButton}
          aria-label={UPLOAD}
          title={UPLOAD}
          disabled={props.disabled}
          onClick={() => void upload()}
        >
          <Icon name="upload" />
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  )
}
