// The display names of the animated WebP files an import listed (S2-17), read from asset.list.
// No query is sent when the list is empty. A refused query gives no names.
import type { AdmanApi } from '@/shared/schemas/api'
import type { AssetList } from '@/shared/schemas/queries/asset'

export async function animatedNames(
  api: AdmanApi,
  projectId: string,
  ids: string[],
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map()
  const result = await api.query('asset.list', { projectId })
  if (!result.ok) return new Map()
  const rows = (result.data as AssetList | null) ?? []
  return new Map(rows.map((row) => [row.id, row.displayName]))
}
