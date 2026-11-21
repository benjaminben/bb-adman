// spec/editor.md, "Picture chooser": the asset library's pictures, and "Import pictures…": the
// system picker, then asset.import linked into the asset library, then the list read again. A
// cancelled picker sends nothing. A path goes only from the picker to asset.import.
import { useCallback, useEffect, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type { AssetList } from '@/shared/schemas/queries/asset'
import type { PickedPaths } from '@/shared/schemas/queries/dialog'

export function usePictures(projectId: string) {
  const api = useApi()
  const [pictures, setPictures] = useState<AssetList | null>(null)
  const [error, setError] = useState<string | null>(null)

  const list = useCallback(async (): Promise<AssetList> => {
    const result = await api.query('asset.list', { projectId, library: 'asset', kind: 'image' })
    return result.ok ? ((result.data as AssetList | null) ?? []) : []
  }, [api, projectId])

  useEffect(() => {
    let live = true
    void list().then((rows) => live && setPictures(rows))
    return () => {
      live = false
    }
  }, [list])

  async function importPictures() {
    const picked = await api.query('dialog.pickFiles', {
      purpose: 'import',
      kind: 'image',
      multiple: true,
    })
    const paths = picked.ok ? ((picked.data as PickedPaths | null)?.paths ?? []) : []
    if (paths.length === 0) return
    const result = await api.command('asset.import', {
      projectId,
      paths,
      library: 'asset',
      copy: false,
    })
    setError(result.ok ? null : result.error.message)
    setPictures(await list())
  }

  return { pictures, error, setError, importPictures }
}
