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

// A managed file is named {assetId}.{ext} in the assets folder (SPEC 3.3).
export function managedPath(assetsDir: string, assetId: string, ext: string): string {
  return path.join(assetsDir, `${assetId}.${ext}`)
}

// The value stored in rel_path: the file's path relative to the project file's folder.
export function relativeToProject(projectFile: string, file: string): string {
  return path.relative(path.dirname(projectFile), file)
}
