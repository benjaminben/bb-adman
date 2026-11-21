// SPEC 3.1 single owner: asset ID to file path. The only file that builds asset paths
// (SPEC 12 module rule). It tries the path relative to the project file first and the full
// path second, for files and for the assets folder alike (SPEC 3.3, 3.9).
import fs from 'node:fs'
import path from 'node:path'

type StoredPaths = { relPath: string; absPath: string }
type AssetsDirMeta = { assetsDirRel: string; assetsDirAbs: string }

async function isFile(p: string): Promise<boolean> {
  try {
    return (await fs.promises.stat(p)).isFile()
  } catch {
    return false
  }
}

function isFolder(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory()
  } catch {
    return false
  }
}

// The asset's file: rel_path against the project file's folder, then abs_path, or
// 'missing' when neither is a file [REQ: FR-009, R-06].
export async function resolveAssetFile(
  projectFile: string,
  stored: StoredPaths,
): Promise<string | 'missing'> {
  const fromRel = path.resolve(path.dirname(projectFile), stored.relPath)
  if (await isFile(fromRel)) return fromRel
  if (await isFile(stored.absPath)) return stored.absPath
  return 'missing'
}

// The assets folder: assets_dir_rel against the project file's folder, then assets_dir_abs.
// When neither is there yet, the rel place, where the first managed file will create it.
export function assetsDirFor(projectFile: string, meta: AssetsDirMeta): string {
  const fromRel = path.resolve(path.dirname(projectFile), meta.assetsDirRel)
  if (isFolder(fromRel)) return fromRel
  if (isFolder(meta.assetsDirAbs)) return meta.assetsDirAbs
  return fromRel
}

// SPEC 3.2: asset IDs are ULIDs. Extensions as in the asset.addGenerated schema. Both are
// checked here, the one owner, so a managed path never leaves the assets folder, whatever a
// project file holds (SPEC 14 [1.30] U3, 8.1).
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/
const EXT = /^[a-z0-9]{1,10}$/

// A managed file is named {assetId}.{ext} in the assets folder (SPEC 3.3).
export function managedPath(assetsDir: string, assetId: string, ext: string): string {
  if (!ULID.test(assetId) || !EXT.test(ext)) {
    throw new Error('A managed path was asked for with an asset ID or extension it cannot use')
  }
  return path.join(assetsDir, `${assetId}.${ext}`)
}

// The value stored in rel_path: the file's path relative to the project file's folder.
export function relativeToProject(projectFile: string, file: string): string {
  return path.relative(path.dirname(projectFile), file)
}

// The path of `file` below `dir` at any depth, or null when it is not inside `dir`.
export function pathInside(dir: string, file: string): string | null {
  const rel = path.relative(path.resolve(dir), path.resolve(file))
  const out = rel === '' || rel === '..' || rel.startsWith(`..${path.sep}`)
  return out || path.isAbsolute(rel) ? null : rel
}

// SPEC 14 [1.34]: true when `p` is `dir` itself or inside it at any depth. The one owner of
// that question for the assets folder check (V1) and the Package target check (V3).
export function pathAtOrInside(dir: string, p: string): boolean {
  return path.resolve(dir) === path.resolve(p) || pathInside(dir, p) !== null
}

// asset.relink siblings (SPEC 14, Slice A rulings point 3): a stored file inside the old
// folder of the named asset is looked for at the same relative path under the new folder.
// Null when the stored file is not inside the old folder or the candidate leaves the new one.
export function siblingCandidate(namedAbsPath: string, newFile: string, absPath: string) {
  const oldDir = path.dirname(path.resolve(namedAbsPath))
  const newDir = path.dirname(path.resolve(newFile))
  const rel = pathInside(oldDir, absPath)
  if (rel === null) return null
  const candidate = path.join(newDir, rel)
  return pathInside(newDir, candidate) === null ? null : { candidate, newDir }
}

// project.setAssetsDir (SPEC 14, Slice A rulings point 4): where a managed file would be in
// another assets folder, keeping its own {assetId}.{ext} name.
export function managedPathIn(assetsDir: string, stored: { id: string; absPath: string }): string {
  return managedPath(assetsDir, stored.id, path.extname(stored.absPath).slice(1))
}
