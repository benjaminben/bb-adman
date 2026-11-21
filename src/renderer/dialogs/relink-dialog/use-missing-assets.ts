// Reads asset.list and keeps the missing assets, only those in onlyAssetIds when given, sorted
// by display name (spec/screens-campaign.md, "Finding missing files: the relink dialog").
import { useCallback, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type { AssetList } from '@/shared/schemas/queries/asset'

export type MissingAsset = AssetList[number]

export function useMissingAssets(projectId: string, onlyAssetIds?: string[]) {
  const api = useApi()
  const [assets, setAssets] = useState<MissingAsset[] | null>(null)
  const [readError, setReadError] = useState<string | null>(null)
  const only = onlyAssetIds?.join('\n')

  const read = useCallback(async (): Promise<MissingAsset[]> => {
    const result = await api.query('asset.list', { projectId })
    if (!result.ok) {
      setReadError(result.error.message)
      setAssets([])
      return []
    }
    const ids = only === undefined ? null : new Set(only.split('\n'))
    const missing = ((result.data as AssetList | null) ?? [])
      .filter((a) => a.missing && (ids === null || ids.has(a.id)))
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
    setReadError(null)
    setAssets(missing)
    return missing
  }, [api, projectId, only])

  return { assets, readError, read }
}
