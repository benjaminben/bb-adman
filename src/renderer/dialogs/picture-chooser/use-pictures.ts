// spec/editor.md, "Picture chooser": the asset library's pictures, and "Import pictures…": the
// system picker, then asset.import linked into the asset library, then the list read again. A
// cancelled picker sends nothing. A path goes only from the picker to asset.import.
// spec/subject-photos.md, "Placing a subject photo later" (SP-8): the reference library's images
// that have a subject, and moveToAssetLibrary, the asset.update sent before such a photo is placed.
import { useCallback, useEffect, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type { AssetList } from '@/shared/schemas/queries/asset'
import type { PickedPaths } from '@/shared/schemas/queries/dialog'

// Only a subject photo is listed from the reference library; any other reference file stays out
// of the chooser (R-12).
const isSubjectPhoto = (row: AssetList[number]) =>
  row.library === 'reference' && row.subjectId !== null

export function usePictures(projectId: string) {
  const api = useApi()
  const [pictures, setPictures] = useState<AssetList | null>(null)
  const [subjectPhotos, setSubjectPhotos] = useState<AssetList>([])
  const [error, setError] = useState<string | null>(null)

  const read = useCallback(
    async (library: 'asset' | 'reference'): Promise<AssetList> => {
      const result = await api.query('asset.list', { projectId, library, kind: 'image' })
      return result.ok ? ((result.data as AssetList | null) ?? []) : []
    },
    [api, projectId],
  )
  const list = useCallback(() => read('asset'), [read])

  useEffect(() => {
    let live = true
    void list().then((rows) => live && setPictures(rows))
    void read('reference').then((rows) => live && setSubjectPhotos(rows.filter(isSubjectPhoto)))
    return () => {
      live = false
    }
  }, [list, read])

  // Resolves to the refusal message, or null when the photo is now in the asset library.
  async function moveToAssetLibrary(assetId: string): Promise<string | null> {
    const result = await api.command('asset.update', { projectId, assetId, library: 'asset' })
    return result.ok ? null : result.error.message
  }

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

  return { pictures, subjectPhotos, error, setError, importPictures, moveToAssetLibrary }
}
