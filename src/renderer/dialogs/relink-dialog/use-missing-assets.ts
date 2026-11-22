// Reads asset.list and keeps the missing assets, only those in onlyAssetIds when given, sorted
// by display name (spec/screens-campaign.md, "Finding missing files: the relink dialog").
// DLG-7: an asset this opening listed as missing that the list now has as not missing is
// "found", so its row can stay in view with a check.
import { useCallback, useRef, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type { AssetList } from '@/shared/schemas/queries/asset'

export type MissingAsset = AssetList[number]

export function useMissingAssets(projectId: string, onlyAssetIds?: string[]) {
  const api = useApi()
  const [assets, setAssets] = useState<MissingAsset[] | null>(null)
  const [found, setFound] = useState<MissingAsset[]>([])
  const [readError, setReadError] = useState<string | null>(null)
  const seen = useRef(new Set<string>())
  const only = onlyAssetIds?.join('\n')

  const read = useCallback(async (): Promise<MissingAsset[]> => {
    const result = await api.query('asset.list', { projectId })
    if (!result.ok) {
      setReadError(result.error.message)
      setAssets([])
      return []
    }
    const ids = only === undefined ? null : new Set(only.split('\n'))
    const byName = (a: MissingAsset, b: MissingAsset) => a.displayName.localeCompare(b.displayName)
    const listed = (result.data as AssetList | null) ?? []
    const missing = listed.filter((a) => a.missing && (ids === null || ids.has(a.id))).sort(byName)
    for (const a of missing) seen.current.add(a.id)
    setFound(listed.filter((a) => !a.missing && seen.current.has(a.id)).sort(byName))
    setReadError(null)
    setAssets(missing)
    return missing
  }, [api, projectId, only])

  return { assets, found, readError, read }
}
