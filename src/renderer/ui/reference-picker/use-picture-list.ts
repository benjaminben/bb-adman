// The pictures one reference picker lists: the project's reference pictures, or (A-68) the
// pictures made in the project, read from asset.list. Only generated rows of the `asset`
// library are kept; an imported ad picture is not offered as a reference.
import { useCallback, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type { Reference } from './reference-list'
import type { AssetList } from '@/shared/schemas/queries/asset'

export type PictureLibrary = 'reference' | 'asset'

export function usePictureList(projectId: string, library: PictureLibrary) {
  const api = useApi()
  const [list, setList] = useState<Reference[] | null>(null)
  const read = useCallback(async () => {
    const result = await api.query('asset.list', { projectId, library, kind: 'image' })
    const rows = result.ok ? ((result.data as AssetList | null) ?? []) : []
    const shown = library === 'asset' ? rows.filter((a) => a.origin === 'generated') : rows
    setList(shown)
    return shown
  }, [api, projectId, library])
  return { list, read }
}
