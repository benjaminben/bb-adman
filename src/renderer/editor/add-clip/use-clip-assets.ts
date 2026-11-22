// P7-20: the asset library's files a clip can show (spec/phases/phase-07.md, "Clips and the
// track"): a PNG, JPEG or WebP picture, or an MP4 or MOV video, whose file is found. "Import…"
// is the editor's import flow: the system picker, then asset.import linked into the asset
// library, then the list read again. A cancelled picker sends nothing. A path goes only from
// the picker to asset.import.
import { useCallback, useEffect, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type { AssetList } from '@/shared/schemas/queries/asset'
import type { PickedPaths } from '@/shared/schemas/queries/dialog'

const USABLE = new Set(['image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/quicktime'])

const usable = (asset: AssetList[number]) =>
  !asset.missing && (asset.kind === 'image' || asset.kind === 'video') && USABLE.has(asset.mime)

// onRefusal gets a refused import's or clip.add's sentence, or null after one that worked.
export function useClipAssets(projectId: string, onRefusal: (message: string | null) => void) {
  const api = useApi()
  const [assets, setAssets] = useState<AssetList | null>(null)

  const list = useCallback(async (): Promise<AssetList> => {
    const result = await api.query('asset.list', { projectId, library: 'asset' })
    return result.ok ? ((result.data as AssetList | null) ?? []).filter(usable) : []
  }, [api, projectId])

  useEffect(() => {
    let live = true
    void list().then((rows) => live && setAssets(rows))
    return () => {
      live = false
    }
  }, [list])

  async function importFiles() {
    const picked = await api.query('dialog.pickFiles', { purpose: 'import', multiple: true })
    const paths = picked.ok ? ((picked.data as PickedPaths | null)?.paths ?? []) : []
    if (paths.length === 0) return
    const result = await api.command('asset.import', {
      projectId,
      paths,
      library: 'asset',
      copy: false,
    })
    onRefusal(result.ok ? null : result.error.message)
    setAssets(await list())
  }

  // clip.add without startMs or lengthMs: the first free place, the default length.
  async function addClip(variantId: string, assetId: string) {
    const result = await api.command('clip.add', { projectId, variantId, assetId })
    onRefusal(result.ok ? null : result.error.message)
  }

  return { assets, importFiles, addClip }
}
