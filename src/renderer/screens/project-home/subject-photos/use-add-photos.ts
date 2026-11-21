// "Add photos" of one subject row (spec/subject-photos.md, "Add photos"; A-110, A-111): the
// system picker, then asset.import linked into the asset library with no subject. A path goes
// only from the picker's answer to asset.import. If the row is gone when the reply comes, each
// new asset is removed again at once.
import { useEffect, useRef } from 'react'
import { useApi } from '@/renderer/app/app-context'
import { pictureName } from '@/shared/brief/picture-name'
import type { AdmanApi } from '@/shared/schemas/api'
import type { AssetImportReply } from '@/shared/schemas/commands/asset'
import type { PickedPaths } from '@/shared/schemas/queries/dialog'
import type { FormPhoto, SubjectChoice } from '@/renderer/screens/project-home/brief-form-model'

export type RowUpdate = (change: (row: SubjectChoice) => SubjectChoice) => void

// asset.remove for each photo this form imported; a refusal is ignored (A-111).
export function removeAddedPhotos(api: AdmanApi, projectId: string, photos: FormPhoto[]) {
  for (const photo of photos)
    if (photo.added) void api.command('asset.remove', { projectId, assetId: photo.assetId })
}

// The row after a successful import: each ID not already in the row, in order, becomes a form
// photo (added unless reused), and each animated one adds its note. paths[i] gave assetIds[i].
export function withImported(
  row: SubjectChoice,
  reply: AssetImportReply,
  paths: string[],
): SubjectChoice {
  const ids = [...new Set(reply.assetIds)].filter((id) => !row.photos.some((p) => p.assetId === id))
  const photos = ids.map((assetId) => ({ assetId, added: !reply.reusedAssetIds.includes(assetId) }))
  const notes = reply.animatedAssetIds.map((id) => {
    const name = pictureName(paths[reply.assetIds.indexOf(id)] ?? '')
    return `${name} holds an animation. Adman uses its first picture.`
  })
  return {
    ...row,
    photos: [...row.photos, ...photos],
    notes: [...row.notes, ...notes],
    adding: false,
  }
}

export function useAddPhotos(projectId: string, update: RowUpdate) {
  const api = useApi()
  const live = useRef(true)
  const latest = useRef(update)

  useEffect(() => {
    latest.current = update
  })
  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])

  // Resolves once the row holds the reply: true, or false when nothing was sent.
  return async function addPhotos(): Promise<boolean> {
    const picked = await api.query('dialog.pickFiles', {
      purpose: 'import',
      kind: 'image',
      multiple: true,
    })
    const paths = picked.ok ? ((picked.data as PickedPaths | null)?.paths ?? []) : []
    if (paths.length === 0 || !live.current) return false
    latest.current((row) => ({ ...row, adding: true }))
    const result = await api.command('asset.import', {
      projectId,
      paths,
      library: 'asset',
      copy: false,
    })
    if (!result.ok) {
      const message = result.error.message
      if (live.current)
        latest.current((row) => ({ ...row, adding: false, notes: [...row.notes, message] }))
      return true
    }
    const reply = result.data as AssetImportReply
    if (live.current) latest.current((row) => withImported(row, reply, paths))
    else {
      const fresh = reply.assetIds.filter((id) => !reply.reusedAssetIds.includes(id))
      removeAddedPhotos(
        api,
        projectId,
        [...new Set(fresh)].map((assetId) => ({ assetId, added: true })),
      )
    }
    return true
  }
}
