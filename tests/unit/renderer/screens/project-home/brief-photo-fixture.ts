// Photos for the brief form model tests (D-098): each subject gets one photo, A1, A2 and so
// on, and IMAGES is the project's pictures holding them.
import type { BriefPhotos } from '@/renderer/screens/project-home/brief-form-model'
import type { BriefDraft } from '@/shared/schemas/brief'
import { assetRow } from '../../editor/editor-fixture'

export const IMAGES = [assetRow('A1'), assetRow('A2'), assetRow('A3')]

export const photosFor = (draft: BriefDraft): BriefPhotos =>
  (draft.subjects ?? []).map((_, i) => ({
    photos: [{ assetId: `A${i + 1}`, added: true }],
    notes: [],
  }))
