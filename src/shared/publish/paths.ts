// The one owner of every published path (spec/storage-and-publish.md "Published layout"):
//   {campaignId}/exports/{postTitle}/{sizeLabel}/{language}-{variantId}.{ext}
//   {campaignId}/components/{folder}[/{subjectId}]/{displayName}-{assetId8}.{ext}
//   {campaignId}/translations.csv, report.html, report.json, manifest.json
// The paths below the campaign folder are relative to it, as the manifest lists them. A project
// file may come from anyone, so every part is checked here (spec/phases/phase-09.md
// "Project-file values that reach a path"); a bad one throws "Storage path refused", no path.
import { isSafePart, safePathPart } from '@/shared/paths/safe-part'
import type { PublishComponentFolder } from '@/shared/schemas/queries/publish'

// The same words as REFUSED_PATH in src/main/providers/storage-paths.ts.
const REFUSED_PATH = 'Storage path refused'

function refuse(): never {
  throw new Error(REFUSED_PATH)
}

export const MANIFEST = 'manifest.json'
export const REPORT_HTML = 'report.html'
export const REPORT_JSON = 'report.json'
export const TRANSLATIONS_CSV = 'translations.csv'

// A-221: the campaign ID form. `campaign-{6}` is one case of it.
const CAMPAIGN_ID_FORM = /^[a-z0-9-]{1,40}-[a-z0-9]{6}$/
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/
const FOLDERS: readonly PublishComponentFolder[] = [
  'backgrounds',
  'logos',
  'subjects',
  'images',
  'fonts',
]
// The extensions a component can have: the image, video and font types of file-types.ts.
export const COMPONENT_EXTENSIONS: readonly string[] = [
  'png',
  'jpg',
  'webp',
  'mp4',
  'mov',
  'webm',
  'ttf',
  'otf',
  'woff2',
]

export const isCampaignIdForm = (id: string) => CAMPAIGN_ID_FORM.test(id) && isSafePart(id)
export const isUlid = (id: string | null): id is string => id !== null && ULID.test(id)

// Every part of a relative path, checked; the path itself when all pass.
function checkedRelative(rel: string): string {
  if (!rel.split('/').every(isSafePart)) refuse()
  return rel
}

export function campaignFolder(campaignId: string): string {
  if (!isCampaignIdForm(campaignId)) refuse()
  return campaignId
}

// A path below the campaign folder, as storage takes it.
export function campaignPath(campaignId: string, rel: string): string {
  return `${campaignFolder(campaignId)}/${checkedRelative(rel)}`
}

// relPath is the export's path relative to the campaign folder (ports.ts ExportedFile).
export function exportPath(relPath: string): string {
  return `exports/${checkedRelative(relPath)}`
}

export type ComponentName = {
  folder: PublishComponentFolder
  // Only for the subjects folder, and then a ULID.
  subjectId: string | null
  displayName: string
  assetId: string
  // From the file-type table for the bytes' type, never from the file name.
  ext: string
}

export function componentPath(c: ComponentName): string {
  if (!FOLDERS.includes(c.folder) || !isUlid(c.assetId)) refuse()
  if (!COMPONENT_EXTENSIONS.includes(c.ext)) refuse()
  if ((c.folder === 'subjects') !== isUlid(c.subjectId)) refuse()
  const folder = c.folder === 'subjects' ? `subjects/${c.subjectId}` : c.folder
  const file = `${safePathPart(c.displayName, 'asset')}-${c.assetId.slice(0, 8)}.${c.ext}`
  return checkedRelative(`components/${folder}/${file}`)
}
