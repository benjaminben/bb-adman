// The pictures one reference picker lists, read from asset.list: the reference pictures
// (every image isReferenceRow passes, SP-7), or (A-68) the pictures made in the project:
// generated rows of the `asset` library with no subject (a subject photo is in the first
// list). An imported ad picture with no subject is not offered as a reference.
// A page that owns the ticks may hear each read of the reference pictures through
// ReferenceRowsContext (the campaign page pre-ticks from it, A-120), so it asks for no list
// of its own.
import { createContext, useCallback, useContext, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type { Reference } from './reference-list'
import { isReferenceRow } from './reference-rows'
import type { AssetList } from '@/shared/schemas/queries/asset'

export type PictureLibrary = 'reference' | 'asset'

export const ReferenceRowsContext = createContext<((rows: Reference[]) => void) | null>(null)

export function usePictureList(projectId: string, library: PictureLibrary) {
  const api = useApi()
  const onRows = useContext(ReferenceRowsContext)
  const [list, setList] = useState<Reference[] | null>(null)
  const read = useCallback(async () => {
    const input =
      library === 'reference' ? { projectId, kind: 'image' } : { projectId, library, kind: 'image' }
    const result = await api.query('asset.list', input)
    const rows = result.ok ? ((result.data as AssetList | null) ?? []) : []
    const shown =
      library === 'asset'
        ? rows.filter((a) => a.origin === 'generated' && a.subjectId === null)
        : rows.filter(isReferenceRow)
    setList(shown)
    if (library === 'reference') onRows?.(shown)
    return shown
  }, [api, projectId, library, onRows])
  return { list, read }
}
