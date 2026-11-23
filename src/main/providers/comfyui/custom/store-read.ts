// spec/comfyui-custom.md "The stored shape", read at start (D-104), security class. Reads
// every {userData}/comfy-workflows/custom-{12 hex}.json, runs the file checks on it and keeps
// the ones that pass. A failed file is skipped with one warn line that holds its ID only:
// no path, no file text and no reason. Other files in the folder are ignored.
import fs from 'node:fs'
import path from 'node:path'
import { MAX_WORKFLOW_BYTES, isCustomWorkflowId } from '@/shared/comfy/custom-workflow'
import type { CustomWorkflowId } from '@/shared/schemas/queries/comfy'
import type { ActivityLog } from '@/main/log/activity-log'
import { readStoredWorkflow, type StoredRead } from './stored'

// A stored file is the graph plus a small wrapper, written as compact JSON.
export const MAX_STORED_BYTES = MAX_WORKFLOW_BYTES + 4_096

export const SKIPPED_MESSAGE = 'A stored workflow was skipped.'

const FILE_NAME = /^(custom-[0-9a-f]{12})\.json$/

// The IDs of the files whose name has the stored form, in name order.
function storedIds(dir: string): CustomWorkflowId[] {
  let names: string[]
  try {
    names = fs.readdirSync(dir)
  } catch {
    return []
  }
  return names
    .sort()
    .map((name) => FILE_NAME.exec(name)?.[1])
    .filter((id): id is CustomWorkflowId => id !== undefined && isCustomWorkflowId(id))
}

// The file's text when it is a regular file (not a link) within the byte limit; the size is
// checked before a byte is read, and again on the bytes read.
function readSmallFile(file: string): string | null {
  try {
    const stat = fs.lstatSync(file)
    if (!stat.isFile() || stat.size > MAX_STORED_BYTES) return null
    const bytes = fs.readFileSync(file)
    return bytes.length > MAX_STORED_BYTES ? null : bytes.toString('utf8')
  } catch {
    return null
  }
}

function readOne(dir: string, id: CustomWorkflowId): StoredRead | null {
  const text = readSmallFile(path.join(dir, `${id}.json`))
  if (text === null) return null
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return null
  }
  const read = readStoredWorkflow(value)
  return read && read.stored.id === id ? read : null
}

// Names are compared trimmed and without letter case: "Beach " and "beach" are one name.
export const nameKey = (name: string) => name.trim().toLowerCase()

// The kept files in order of addedAt. A file whose name another kept file already has (in
// any letter case) is skipped too, so names stay unique.
export function readStoredFolder(dir: string, log: ActivityLog): StoredRead[] {
  const skip = (workflowId: string) =>
    log.write({
      level: 'warn',
      event: 'app',
      name: 'comfyWorkflow.read',
      actor: 'system',
      ok: false,
      message: SKIPPED_MESSAGE,
      context: { workflowId },
    })
  const reads: StoredRead[] = []
  for (const id of storedIds(dir)) {
    const read = readOne(dir, id)
    if (read) reads.push(read)
    else skip(id)
  }
  reads.sort((a, b) => Date.parse(a.stored.addedAt) - Date.parse(b.stored.addedAt))
  const names = new Set<string>()
  return reads.filter((read) => {
    const key = nameKey(read.stored.name)
    if (names.has(key)) {
      skip(read.stored.id)
      return false
    }
    names.add(key)
    return true
  })
}
