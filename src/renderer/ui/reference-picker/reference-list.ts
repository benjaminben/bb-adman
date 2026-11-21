// The project's reference pictures (SPEC 14 1.46 TP-5), shared by the picture panel's picker
// and the video card's picture choice (1.60 CU-6b-R N-9): the list from asset.list (every
// image isReferenceRow passes, SP-7), why a picture cannot be sent, and "Add pictures"
// through the system picker and asset.import. No path is drawn or read here; a path goes
// only from the system picker to asset.import.
import { useCallback, useState } from 'react'
import { useApi, useApp } from '@/renderer/app/app-context'
import type { AssetList } from '@/shared/schemas/queries/asset'
import type { PickedPaths } from '@/shared/schemas/queries/dialog'
import { isReferenceRow } from './reference-rows'

export { whyNot } from './reference-rows'

export type Reference = AssetList[number]
type ImportReply = { assetIds: string[] }

export function useReferences(projectId: string) {
  const api = useApi()
  const [list, setList] = useState<Reference[] | null>(null)
  const read = useCallback(async () => {
    const result = await api.query('asset.list', { projectId, kind: 'image' })
    const rows = (result.ok ? ((result.data as AssetList | null) ?? []) : []).filter(isReferenceRow)
    setList(rows)
    return rows
  }, [api, projectId])
  return { list, read }
}

// Picks files, imports them as linked references, reads the list again, and gives the new
// rows and the added IDs; null when nothing was picked or the import was refused.
export function useAddPictures(
  projectId: string,
  subjectId: string | undefined,
  read: () => Promise<Reference[]>,
) {
  const api = useApi()
  const command = useApp((s) => s.command)
  return async (): Promise<{ rows: Reference[]; added: string[] } | null> => {
    const picked = await api.query('dialog.pickFiles', {
      purpose: 'import',
      kind: 'image',
      multiple: true,
    })
    const paths = picked.ok ? ((picked.data as PickedPaths | null)?.paths ?? []) : []
    if (paths.length === 0) return null
    const result = await command('asset.import', {
      projectId,
      paths,
      library: 'reference',
      copy: false,
      ...(subjectId === undefined ? {} : { subjectId }),
    })
    if (!result.ok) return null
    const rows = await read()
    return { rows, added: [...new Set((result.data as ImportReply | null)?.assetIds ?? [])] }
  }
}
