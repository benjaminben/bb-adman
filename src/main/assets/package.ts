// SPEC 3.1 single owner: the layout of a packaged project (SPEC 3.9; FR-008, R-09).
//   {targetDir}/{Name}/{Name}.adman and {targetDir}/{Name}/{Name} Assets/{assetId}.{ext}
// Work happens in {Name}.partial and is renamed at the end; on failure the partial folder
// is deleted. Only the copy is written; the open project is only read.
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { ulid } from 'ulid'
import type { ProjectHandle } from '@/main/db/project-file'
import { readMeta, writeMeta } from '@/main/db/meta'
import { readWireRows } from '@/main/db/rows'
import { assetsDirOf, resolveRow } from './service'
import { hashFile, sniffFile } from './inspect'
import { isManagedName, managedPath, pathAtOrInside } from './path-resolver'
import { missingFile } from './errors'
import { extensionOf, fileTypeFor, type AssetKind } from '@/shared/config/file-types'
import type { AssetRow } from '@/shared/schemas/rows/asset'
import type { PackageResult } from '@/shared/schemas/commands/asset'
import { AppError } from '@/shared/schemas/result'
import { notAProject } from '@/main/db/meta'

type Found = { id: string; file: string; ext: string }

// The real path, so a link cannot hide where a folder is; the path itself when it is not there.
function realOrSelf(p: string): Promise<string> {
  return fs.promises.realpath(p).catch(() => path.resolve(p))
}

// SPEC 14 [1.30] U2: {Name} and {Name}.partial must be direct children of targetDir, whatever
// the project file holds, so nothing is ever made outside it.
function checkChildren(targetDir: string, name: string) {
  const dir = path.resolve(targetDir)
  for (const child of [name, `${name}.partial`]) {
    const p = path.resolve(dir, child)
    if (path.dirname(p) !== dir || path.basename(p) !== child) throw notAProject()
  }
}

async function checkTarget(project: ProjectHandle, targetDir: string, name: string) {
  if (!path.isAbsolute(targetDir)) throw new AppError('INVALID_INPUT', 'Choose a folder.')
  const stat = await fs.promises.stat(targetDir).catch(() => null)
  if (!stat?.isDirectory()) throw new AppError('NOT_FOUND', 'That folder was not found.')
  const [assetsDir, realTarget] = await Promise.all([
    realOrSelf(assetsDirOf(project)),
    realOrSelf(targetDir),
  ])
  // SPEC 14 [1.34] V3: the assets folder itself is refused too.
  if (pathAtOrInside(assetsDir, realTarget)) {
    throw new AppError('RULE_VIOLATION', "Choose a folder outside the project's assets folder.")
  }
  const named = await fs.promises.lstat(path.join(targetDir, name)).catch(() => null)
  if (named && !named.isDirectory()) {
    throw new AppError('RULE_VIOLATION', `Something named ${name} is already there.`)
  }
  const entries = await fs.promises.readdir(path.join(targetDir, name)).catch(() => [])
  if (entries.length > 0) {
    throw new AppError('RULE_VIOLATION', `A folder named ${name} is already there and not empty.`)
  }
}

// SPEC 14 [1.30] U4: the extension comes from the base name only, must be one listed for the
// row's kind, and the first bytes must match that type. Null means treat the asset as missing.
async function extensionFor(file: string, kind: AssetKind): Promise<string | null> {
  const type = fileTypeFor(path.basename(file))
  if (type?.kind !== kind) return null
  return (await sniffFile(file)) === type ? extensionOf(path.basename(file)) : null
}

async function findFiles(project: ProjectHandle, skipMissing: boolean) {
  const rows = readWireRows(project.db, 'asset') as AssetRow[]
  const resolved = await Promise.all(
    rows.map(async (r) => {
      const file = await resolveRow(project, r)
      return file === 'missing' ? null : { file, ext: await extensionFor(file, r.kind) }
    }),
  )
  const found: Found[] = []
  const missing: string[] = []
  rows.forEach((r, i) => {
    const hit = resolved[i]
    // SPEC 14 [1.34] V2: a row whose id cannot form a file name is treated as missing.
    if (!hit?.ext || !isManagedName(r.id, hit.ext)) missing.push(r.id)
    else found.push({ id: r.id, file: hit.file, ext: hit.ext })
  })
  if (missing.length > 0 && !skipMissing) throw missingFile(missing)
  return { found, missing }
}

// The copy, opened with trusted_schema off: a view or trigger in it cannot call an
// app-defined function while it is rewritten.
export function openPackageCopy(dbFile: string): Database.Database {
  const db = new Database(dbFile)
  db.pragma('trusted_schema = OFF')
  return db
}

// Step 6: paths, meta and jobs rewritten in the copy, in one transaction.
async function rewriteCopy(dbFile: string, finalDir: string, assetsName: string, found: Found[]) {
  const facts = await Promise.all(
    found.map(async (f) => {
      const file = managedPath(path.join(path.dirname(dbFile), assetsName), f.id, f.ext)
      const stat = await fs.promises.stat(file)
      return { ...f, name: path.basename(file), stat, hash: await hashFile(file) }
    }),
  )
  const db = openPackageCopy(dbFile)
  try {
    const update = db.prepare(
      `UPDATE asset SET storage = 'managed', rel_path = ?, abs_path = ?, byte_size = ?,
        mtime_ms = ?, content_hash = ? WHERE id = ?`,
    )
    db.transaction(() => {
      for (const f of facts) {
        const rel = path.join(assetsName, f.name)
        const abs = path.join(finalDir, rel)
        update.run(rel, abs, f.stat.size, Math.trunc(f.stat.mtimeMs), f.hash, f.id)
      }
      writeMeta(db, {
        projectId: ulid(),
        assetsDirRel: assetsName,
        assetsDirAbs: path.join(finalDir, assetsName),
      })
      db.prepare("UPDATE job SET status = 'cancelled' WHERE status IN ('queued', 'running')").run()
    })()
  } finally {
    db.close()
  }
}

// SPEC 14 [1.34] V5: the name is read once, in packageProject, and handed in.
type BuildPlan = { name: string; partial: string; finalDir: string; found: Found[] }

async function build(project: ProjectHandle, { name, partial, finalDir, found }: BuildPlan) {
  const assetsName = `${name} Assets`
  await fs.promises.mkdir(path.join(partial, assetsName), { recursive: true })
  const dbFile = path.join(partial, `${name}.adman`)
  await project.db.backup(dbFile)
  for (const f of found) {
    const target = managedPath(path.join(partial, assetsName), f.id, f.ext)
    await fs.promises.copyFile(f.file, target, fs.constants.COPYFILE_EXCL)
  }
  await rewriteCopy(dbFile, finalDir, assetsName, found)
}

async function sizeOf(files: string[]): Promise<number> {
  const stats = await Promise.all(files.map((f) => fs.promises.stat(f)))
  return stats.reduce((sum, s) => sum + s.size, 0)
}

export async function packageProject(
  project: ProjectHandle,
  targetDir: string,
  skipMissing: boolean,
): Promise<PackageResult> {
  const { name } = readMeta(project.db)
  checkChildren(targetDir, name)
  await checkTarget(project, targetDir, name)
  const { found, missing } = await findFiles(project, skipMissing)
  const finalDir = path.join(targetDir, name)
  const partial = path.join(targetDir, `${name}.partial`)
  await fs.promises.mkdir(partial).catch((e: NodeJS.ErrnoException) => {
    if (e.code !== 'EEXIST') throw e
    throw new AppError('RULE_VIOLATION', `A folder named ${name}.partial is in the way.`)
  })
  try {
    await build(project, { name, partial, finalDir, found })
    // checkTarget found {Name} absent or empty; rmdir removes only an empty folder.
    await fs.promises.rmdir(finalDir).catch(() => undefined)
    await fs.promises.rename(partial, finalDir)
  } catch (e) {
    await fs.promises.rm(partial, { recursive: true, force: true })
    throw e
  }
  const assetsDir = path.join(finalDir, `${name} Assets`)
  const files = [
    path.join(finalDir, `${name}.adman`),
    ...found.map((f) => managedPath(assetsDir, f.id, f.ext)),
  ]
  return {
    packagePath: finalDir,
    fileCount: files.length,
    totalBytes: await sizeOf(files),
    skippedAssetIds: missing,
  }
}
