// spec/approvals.md "Pictures": the one owner of picture paths. The folder is
// adman-approvals/{projectId}/{campaignId}/ and a file is {folder}{variantId}-{rev}.png. Every
// part is checked before use (ULID, the campaign ID rule, the variant ID rule, a whole number);
// a failure throws "Storage path refused", which holds no path. The picture stores check every
// path they are given here, so nothing outside one campaign's folder is listed, written,
// signed or removed.
import { CampaignId, ProjectId, VariantKey } from './contract'

export const PICTURE_ROOT = 'adman-approvals'

// The same words as REFUSED_PATH in src/main/providers/storage-paths.ts, which src/shared may
// not import; a test keeps the two equal.
const REFUSED_PATH = 'Storage path refused'

function refuse(): never {
  throw new Error(REFUSED_PATH)
}

const WHOLE = /^(0|[1-9][0-9]*)$/

function checkFolderParts(projectId: string, campaignId: string): void {
  if (!ProjectId.safeParse(projectId).success) refuse()
  if (!CampaignId.safeParse(campaignId).success) refuse()
}

export function pictureFolder(projectId: string, campaignId: string): string {
  checkFolderParts(projectId, campaignId)
  return `${PICTURE_ROOT}/${projectId}/${campaignId}/`
}

export function picturePath(
  projectId: string,
  campaignId: string,
  variantId: string,
  rev: number,
): string {
  const folder = pictureFolder(projectId, campaignId)
  if (!VariantKey.safeParse(variantId).success) refuse()
  if (!Number.isSafeInteger(rev) || rev < 0) refuse()
  return `${folder}${variantId}-${rev}.png`
}

// The campaign folder a picture file sits in; refused unless the path is exactly one that
// picturePath builds.
export function pictureFolderOf(path: string): string {
  const parts = path.split('/')
  if (parts.length !== 4 || parts[0] !== PICTURE_ROOT) refuse()
  const [, projectId = '', campaignId = '', file = ''] = parts
  const match = /^([^-]*)-([^.]*)\.png$/.exec(file)
  const rev = match?.[2] ?? ''
  if (!match || !WHOLE.test(rev)) refuse()
  if (picturePath(projectId, campaignId, match[1] ?? '', Number(rev)) !== path) refuse()
  return `${PICTURE_ROOT}/${projectId}/${campaignId}/`
}

// A whole campaign folder, as pictureFolder builds it; refused otherwise.
export function checkPictureFolder(folder: string): string {
  const parts = folder.split('/')
  if (parts.length !== 4 || parts[0] !== PICTURE_ROOT || parts[3] !== '') refuse()
  if (pictureFolder(parts[1] ?? '', parts[2] ?? '') !== folder) refuse()
  return folder
}

function isPictureIn(folder: string, path: string): boolean {
  try {
    return pictureFolderOf(path) === folder
  } catch {
    return false
  }
}

// What a listing of the folder may give back: picture files directly inside it, nothing else.
export function picturesIn(folder: string, found: string[]): string[] {
  checkPictureFolder(folder)
  return found.filter((path) => isPictureIn(folder, path))
}

// The longest a picture address may last: 7 days, the most S3 allows. Both picture stores
// refuse a longer or a broken lifetime before anything is called.
export const PICTURE_URL_MAX_SECONDS = 604_800
export const REFUSED_LIFETIME = 'Signed address lifetime refused'

export function checkPictureLifetime(seconds: number): number {
  if (Number.isInteger(seconds) && seconds >= 1 && seconds <= PICTURE_URL_MAX_SECONDS) {
    return seconds
  }
  throw new Error(REFUSED_LIFETIME)
}

// The one campaign folder a removal stays in; refused when the paths span two folders or one
// is not a picture file. An empty list gives null.
export function removalFolder(paths: string[]): string | null {
  const folders = new Set(paths.map(pictureFolderOf))
  if (folders.size > 1) refuse()
  return [...folders][0] ?? null
}
