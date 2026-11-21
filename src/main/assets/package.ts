// SPEC 3.1 single owner: the layout of a packaged project (SPEC 3.9; FR-008, R-09).
//   {targetDir}/{Name}/{Name}.adman and {targetDir}/{Name}/{Name} Assets/{assetId}.{ext}
// Work happens in {Name}.partial and is renamed at the end; on failure the partial folder
// is deleted. Only the copy is written; the open project is only read.
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { ulid } from 'ulid'
import type { ProjectHandle } from '../db/project-file'
import { readMeta, writeMeta } from '../db/meta'
import { readWireRows } from '../db/rows'
import { assetsDirOf, resolveRow } from './service'
import { hashFile } from './inspect'
import { managedPath } from './path-resolver'
import { missingFile } from './errors'
import { extensionOf } from '../../shared/config/file-types'
import type { AssetRow } from '../../shared/schemas/rows/asset'
import type { PackageResult } from '../../shared/schemas/commands/asset'
import { AppError } from '../../shared/schemas/result'
import { notAProject } from '../db/meta'

type Found = { id: string; file: string; ext: string }

function isInside(parent: string, child: string): boolean {
  const rel = path.relative(parent, child)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
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
  if (isInside(assetsDirOf(project), targetDir)) {
    throw new AppError('RULE_VIOLATION', "Choose a folder outside the project's assets folder.")
  }
  const entries = await fs.promises.readdir(path.join(targetDir, name)).catch(() => [])
  if (entries.length > 0) {
    throw new AppError('RULE_VIOLATION', `A folder named ${name} is already there and not empty.`)
  }
}

async function findFiles(project: ProjectHandle, skipMissing: boolean) {
  const rows = readWireRows(project.db, 'asset') as AssetRow[]
  const resolved = await Promise.all(rows.map((r) => resolveRow(project, r)))
  const found: Found[] = []
  const missing: string[] = []
  rows.forEach((r, i) => {
    const file = resolved[i] ?? 'missing'
    if (file === 'missing') missing.push(r.id)
    else found.push({ id: r.id, file, ext: extensionOf(file) })
  })
  if (missing.length > 0 && !skipMissing) throw missingFile(missing)
  return { found, missing }
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
  const db = new Database(dbFile)
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

async function build(project: ProjectHandle, partial: string, finalDir: string, found: Found[]) {
  const { name } = readMeta(project.db)
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
    await build(project, partial, finalDir, found)
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
