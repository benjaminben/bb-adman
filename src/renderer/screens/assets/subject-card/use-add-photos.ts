// R2C-6 (spec/phases/round-2-campaign.md, design addition 5, "Add photos", A-317). The paths
// the system picker gives go to asset.import and nowhere else: they are not kept once the
// import is sent. importPhotos runs the import and the attach step; the subject dialog uses it
// too. Commands go through the app store, so a refusal also shows in the error banner.
import { useState } from 'react'
import { useApi, useApp } from '@/renderer/app/app-context'
import { animationLines } from '@/renderer/dialogs/import-dialog/import-text'
import { addedCount, attachPlan, noteLines } from '@/renderer/screens/assets/attach-photos'
import { assetView, type AssetView } from '@/renderer/screens/assets/assets-panel/asset-view'
import type { AdmanApi } from '@/shared/schemas/api'
import type { AssetImportReply } from '@/shared/schemas/commands/asset'
import type { PickedPaths } from '@/shared/schemas/queries/dialog'
import type { AssetList } from '@/shared/schemas/queries/asset'
import type { SubjectRow } from '@/shared/schemas/rows/subject'
import type { Result } from '@/shared/schemas/result'

type Command = (name: string, input: unknown) => Promise<Result<unknown>>
export type PhotosOutcome =
  { ok: true; count: number; notes: string[] } | { ok: false; message: string }
export type AddPhotos =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'done'; lines: string[] }
  | { kind: 'refused'; message: string }

export const PICK_PHOTOS = { purpose: 'import', kind: 'image', multiple: true } as const

export async function pickPhotos(api: AdmanApi): Promise<string[]> {
  const reply = await api.query('dialog.pickFiles', PICK_PHOTOS)
  return reply.ok ? ((reply.data as PickedPaths | null)?.paths ?? []) : []
}

// The views of the listed rows (no path kept), read only when a reused or animated file needs
// a name or a subject.
async function listed(api: AdmanApi, projectId: string, needed: boolean): Promise<AssetView[]> {
  if (!needed) return []
  const reply = await api.query('asset.list', { projectId })
  return reply.ok ? ((reply.data as AssetList | null) ?? []).map(assetView) : []
}

export async function importPhotos(
  api: AdmanApi,
  command: Command,
  to: { projectId: string; paths: string[]; subjectId: string; subjects: SubjectRow[] },
): Promise<PhotosOutcome> {
  const { projectId, subjectId } = to
  const input = { projectId, paths: to.paths, library: 'asset', copy: false, subjectId }
  const reply = await command('asset.import', input)
  if (!reply.ok) return { ok: false, message: reply.error.message }
  const data = (reply.data as Partial<AssetImportReply> | null) ?? {}
  const done = { assetIds: data.assetIds ?? [], reusedAssetIds: data.reusedAssetIds ?? [] }
  const animated = data.animatedAssetIds ?? []
  const assets = await listed(api, projectId, done.reusedAssetIds.length + animated.length > 0)
  const plan = attachPlan(done, assets, subjectId)
  for (const assetId of plan.updates)
    await command('asset.update', { projectId, assetId, subjectId })
  const names = new Map(assets.map((a) => [a.id, a.displayName]))
  return {
    ok: true,
    count: addedCount(done, plan),
    notes: [...noteLines(plan.notes, assets, to.subjects), ...animationLines(animated, names)],
  }
}

export function useAddPhotos(projectId: string, subjectId: string, subjects: SubjectRow[]) {
  const api = useApi()
  const command = useApp((s) => s.command)
  const [state, setState] = useState<AddPhotos>({ kind: 'idle' })

  async function add() {
    const paths = await pickPhotos(api)
    if (paths.length === 0) return
    setState({ kind: 'busy' })
    const outcome = await importPhotos(api, command, { projectId, paths, subjectId, subjects })
    if (!outcome.ok) return setState({ kind: 'refused', message: outcome.message })
    setState({ kind: 'done', lines: [`${outcome.count} photo(s) added.`, ...outcome.notes] })
  }

  return { state, add: () => void add() }
}
