// R2C-6 (spec/phases/round-2-campaign.md, design addition 5, "The attach step", A-318). Pure.
// asset.import with a subject attaches the new files only: a file the project already held
// keeps its library and subject. So a reused photo with no subject is attached afterwards with
// asset.update, and one that is another subject's photo is left there, with a note.
import type { AssetImportReply } from '@/shared/schemas/commands/asset'
import type { SubjectRow } from '@/shared/schemas/rows/subject'
import type { AssetView } from './assets-panel/asset-view'

export type AttachNote = { assetId: string; otherSubjectId: string }
export type AttachPlan = { updates: string[]; notes: AttachNote[] }
type Reply = Pick<AssetImportReply, 'assetIds' | 'reusedAssetIds'>
type Known = Pick<AssetView, 'id' | 'subjectId' | 'displayName'>

export function attachPlan(reply: Reply, assets: Known[], subjectId: string): AttachPlan {
  const byId = new Map(assets.map((a) => [a.id, a]))
  const plan: AttachPlan = { updates: [], notes: [] }
  for (const id of new Set(reply.reusedAssetIds)) {
    const held = byId.get(id)
    if (held === undefined || held.subjectId === subjectId) continue
    if (held.subjectId === null) plan.updates.push(id)
    else plan.notes.push({ assetId: id, otherSubjectId: held.subjectId })
  }
  return plan
}

// The photos the subject gained: each new file, and each reused one that was attached.
export function addedCount(reply: Reply, plan: AttachPlan): number {
  const reused = new Set(reply.reusedAssetIds)
  const fresh = new Set(reply.assetIds.filter((id) => !reused.has(id))).size
  return fresh + plan.updates.length
}

export function noteLines(
  notes: AttachNote[],
  assets: Known[],
  subjects: Array<Pick<SubjectRow, 'id' | 'name'>>,
): string[] {
  const names = new Map(assets.map((a) => [a.id, a.displayName]))
  const subjectNames = new Map(subjects.map((s) => [s.id, s.name]))
  return notes.map((note) => {
    const name = names.get(note.assetId) ?? 'A file'
    const other = subjectNames.get(note.otherSubjectId) ?? 'another subject'
    return `${name} is already a photo of ${other}. It was left there.`
  })
}
