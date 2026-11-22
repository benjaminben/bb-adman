// P7-21: the assets library's audio files for the 'file' sound, and "Add audio…": the system
// picker with kind audio, then asset.import linked into the assets library, then the list read
// again. A cancelled picker sends nothing. A path goes only from the picker to asset.import.
import { useCallback, useEffect, useState } from 'react'
import type { AdmanApi } from '@/shared/schemas/api'
import type { AssetImportReply } from '@/shared/schemas/commands/asset'
import type { AssetList } from '@/shared/schemas/queries/asset'
import type { PickedPaths } from '@/shared/schemas/queries/dialog'

type Imported = { assetId: string } | { error: string } | null

export function useAudioAssets(api: AdmanApi, projectId: string) {
  const [assets, setAssets] = useState<AssetList | null>(null)

  const list = useCallback(async (): Promise<AssetList> => {
    const result = await api.query('asset.list', { projectId, library: 'asset' })
    const rows = result.ok ? ((result.data as AssetList | null) ?? []) : []
    return rows.filter((asset) => asset.kind === 'audio')
  }, [api, projectId])

  useEffect(() => {
    let live = true
    void list().then((rows) => live && setAssets(rows))
    return () => {
      live = false
    }
  }, [list])

  // The first imported file's ID, the refusal's sentence, or null when nothing was picked.
  async function importAudio(): Promise<Imported> {
    const input = { purpose: 'import', kind: 'audio', multiple: false }
    const picked = await api.query('dialog.pickFiles', input)
    const paths = picked.ok ? ((picked.data as PickedPaths | null)?.paths ?? []) : []
    if (paths.length === 0) return null
    const result = await api.command('asset.import', {
      projectId,
      paths,
      library: 'asset',
      copy: false,
    })
    setAssets(await list())
    if (!result.ok) return { error: result.error.message }
    const assetId = (result.data as AssetImportReply | null)?.assetIds[0]
    return assetId ? { assetId } : null
  }

  return { assets, importAudio }
}
