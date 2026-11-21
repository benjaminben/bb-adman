// spec/editor.md, "Fonts: upload and choice" [REQ: FR-056, FR-093]: the "Font" select lists the
// default font, then every font of the asset library by its fontFamily (else its display name);
// a missing one says "(file not found)". "Upload font…" picks one font file through the system
// picker, imports it linked into the asset library and sets it as the font. A cancelled picker
// sends nothing; a refused import shows its message and changes nothing. Font names from a file
// are shown as text only. A path goes only from the picker to asset.import.
import { useCallback, useEffect, useId, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type { AssetList } from '@/shared/schemas/queries/asset'
import type { PickedPaths } from '@/shared/schemas/queries/dialog'
import styles from './font-field.module.css'

export type FontFieldProps = {
  projectId: string
  fontAssetId: string | null
  disabled: boolean
  // Resolves to the refusal message, or null when the font was set.
  onChange: (fontAssetId: string | null) => Promise<string | null>
}

type ImportReply = { assetIds: string[] }

const labelOf = (asset: AssetList[number]) =>
  `${asset.fontFamily ?? asset.displayName}${asset.missing ? ' (file not found)' : ''}`

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

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        Font
      </label>
      <select
        id={id}
        aria-describedby={error ? `${id}-error` : undefined}
        disabled={props.disabled}
        value={props.fontAssetId ?? ''}
        onChange={(event) => void choose(event.target.value || null)}
      >
        <option value="">Default font (Inter)</option>
        {fonts.map((f) => (
          <option key={f.id} value={f.id}>
            {labelOf(f)}
          </option>
        ))}
        {!known && <option value={props.fontAssetId ?? ''}>Font not in the asset library</option>}
      </select>
      <button
        type="button"
        className={styles.upload}
        disabled={props.disabled}
        onClick={() => void upload()}
      >
        Upload font…
      </button>
      {error && (
        <p id={`${id}-error`} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  )
}
