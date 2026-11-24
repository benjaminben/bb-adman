// spec/brief-brand.md "brief.parse" (security class): the logo and the two fonts a brief a
// person loads or pastes names. Each text is checked as a subject's picture text is
// (brief-file-check.ts), with the kind its role wants. An asset ID must be of that kind and in
// the asset library: a layer may not use a reference-library file (R-12, A-405). A bad text
// gives a note, never an error. Nothing here logs, and a note's name is pictureName's, so no
// note holds a folder. A blank text is checked like any other and so gets a note, as a blank
// picture text does.
import { checkBriefFile, lazyFolderOf, type WantedKind } from './brief-file-check'
import { brandFileTexts } from '@/shared/brief/brand'
import { pictureName } from '@/shared/brief/picture-name'
import type { BriefDraft } from '@/shared/schemas/brief'
import type { BrandFiles, BrandRole } from '@/shared/schemas/commands/brief'

// The kind and library of an asset of the open project, or null when it has none of that ID.
export type BrandAssetOf = (assetId: string) => { kind: string; library: string } | null

export type BriefBrandOptions = {
  assetOf: BrandAssetOf
  // Given so a test can judge paths by another system's rules.
  platform?: NodeJS.Platform
}

const KIND_OF: Record<BrandRole, WantedKind> = {
  logo: 'image',
  headingFont: 'font',
  bodyFont: 'font',
}

// briefPath is the absolute path of the brief file, or null for pasted text, which has no
// folder. files are in role order; two roles may carry the same file.
export async function checkBriefBrand(
  briefPath: string | null,
  draft: BriefDraft,
  options: BriefBrandOptions,
): Promise<BrandFiles> {
  const result: BrandFiles = { files: [], notes: [] }
  const texts = brandFileTexts(draft)
  if (texts.length === 0) return result
  const folderOf = lazyFolderOf(briefPath)
  for (const { role, text } of texts) {
    const kind = KIND_OF[role]
    const isWanted = (id: string) => {
      const asset = options.assetOf(id)
      return asset !== null && asset.kind === kind && asset.library === 'asset'
    }
    const checked = await checkBriefFile(folderOf, text, kind, {
      isWanted,
      platform: options.platform,
    })
    if ('reason' in checked) {
      result.notes.push({ role, name: pictureName(text), reason: checked.reason })
    } else if ('assetId' in checked) {
      result.files.push({ role, path: null, assetId: checked.assetId })
    } else result.files.push({ role, path: checked.real, assetId: null })
  }
  return result
}
