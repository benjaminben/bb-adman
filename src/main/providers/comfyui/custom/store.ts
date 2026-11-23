// spec/comfyui-custom.md "The stored shape" (D-104), security class: the workflows a person
// or an agent added, one file each in {userData}/comfy-workflows/. The folder is the list;
// this store reads it once at start and is its only writer. A file path is built only from
// an ID that matches CUSTOM_WORKFLOW_ID. No path or file text reaches an error or a log line.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { SizeRule } from '@/shared/comfy/fit-size'
import {
  CUSTOM_SIZE_DEFAULTS,
  CUSTOM_VIDEO_DEFAULT,
  MAX_CUSTOM_WORKFLOWS,
  MAX_WORKFLOW_NAME,
  isCustomWorkflowId,
} from '@/shared/comfy/custom-workflow'
import { customWorkflowRefusal } from '@/shared/providers/custom-workflow-messages'
import type { CustomWorkflowId, WorkflowVideo } from '@/shared/schemas/queries/comfy'
import { AppError } from '@/shared/schemas/result'
import type { ActivityLog } from '@/main/log/activity-log'
import type { WorkflowSpec } from '@/main/providers/comfyui/workflows/types'
import type { CheckedWorkflow } from './check-file'
import type { StoredCustomWorkflow } from './stored'
import { nameKey, readStoredFolder } from './store-read'
import { toCustomSpec } from './to-spec'

export type CustomEntry = {
  stored: StoredCustomWorkflow
  checked: CheckedWorkflow
  spec: WorkflowSpec
}

export type NewWorkflow = {
  checked: CheckedWorkflow
  name: string
  addedBy: 'user' | 'agent'
  video?: WorkflowVideo
}

export type WorkflowChange = { name?: string; size?: SizeRule; video?: WorkflowVideo }

export type CustomWorkflowStore = ReturnType<typeof createCustomWorkflowStore>

const SAVE_FAILED = 'Adman could not save the workflow.'
const REMOVE_FAILED = 'Adman could not remove the workflow.'

const refuse = (reason: 'workflow_limit' | 'workflow_name_taken') =>
  new AppError('RULE_VIOLATION', customWorkflowRefusal({ reason }).message, { reason })

const entryOf = (stored: StoredCustomWorkflow, checked: CheckedWorkflow): CustomEntry => ({
  stored,
  checked,
  spec: toCustomSpec(stored),
})

export function createCustomWorkflowStore(opts: {
  dir: string
  log: ActivityLog
  now: () => Date
  newId?: () => CustomWorkflowId
}) {
  const newId = opts.newId ?? (() => `custom-${crypto.randomBytes(6).toString('hex')}` as const)
  // A Map, so a lookup by a name from input never reaches an inherited key.
  const entries = new Map<string, CustomEntry>()
  for (const read of readStoredFolder(opts.dir, opts.log)) {
    entries.set(read.stored.id, entryOf(read.stored, read.checked))
  }

  const fileOf = (id: CustomWorkflowId) => path.join(opts.dir, `${id}.json`)

  // As settings.json is written: a temporary file, then a rename. Compact JSON.
  function save(stored: StoredCustomWorkflow): void {
    const tmp = `${fileOf(stored.id)}.tmp`
    try {
      fs.mkdirSync(opts.dir, { recursive: true })
      fs.writeFileSync(tmp, JSON.stringify(stored))
      fs.renameSync(tmp, fileOf(stored.id))
    } catch {
      try {
        fs.rmSync(tmp, { force: true })
      } catch {
        // The fixed error below is the one the caller gets.
      }
      throw new Error(SAVE_FAILED)
    }
  }

  function nameTaken(name: string, except?: string): boolean {
    const key = nameKey(name)
    return [...entries.values()].some(
      (e) => e.stored.id !== except && nameKey(e.stored.name) === key,
    )
  }

  // The limit and the name rule of an add, the one owner. The permission broker runs it
  // before an agent's ask too (CW-6a), so a refused add never reaches the screen.
  function checkAdd(name: string): void {
    if (entries.size >= MAX_CUSTOM_WORKFLOWS) throw refuse('workflow_limit')
    if (nameTaken(name)) throw refuse('workflow_name_taken')
  }

  function get(id: string): CustomEntry | undefined {
    return isCustomWorkflowId(id) ? entries.get(id) : undefined
  }

  return {
    // In order of addedAt.
    list: (): CustomEntry[] => [...entries.values()],
    specs: (): WorkflowSpec[] => [...entries.values()].map((e) => e.spec),
    get,

    // The name, or the name with " 2", " 3" … when taken, cut so it stays within 60.
    freeName(base: string): string {
      if (!nameTaken(base)) return base
      for (let n = 2; ; n++) {
        const suffix = ` ${n}`
        const cut = [...base].slice(0, MAX_WORKFLOW_NAME - suffix.length).join('')
        const name = `${cut.trimEnd()}${suffix}`
        if (!nameTaken(name)) return name
      }
    },

    checkAdd,

    add(input: NewWorkflow): CustomEntry {
      checkAdd(input.name)
      const { checked } = input
      let id = newId()
      while (entries.has(id)) id = newId()
      const isVideo = checked.job === 'video'
      const stored: StoredCustomWorkflow = {
        format: 1,
        id,
        name: input.name,
        addedBy: input.addedBy,
        addedAt: opts.now().toISOString(),
        size: checked.slots.width === undefined ? null : CUSTOM_SIZE_DEFAULTS[checked.job],
        video: isVideo ? (input.video ?? CUSTOM_VIDEO_DEFAULT) : null,
        graph: checked.graph,
      }
      const entry = entryOf(stored, checked)
      save(stored)
      entries.set(id, entry)
      return entry
    },

    // The caller has checked that a size or video change fits the graph.
    update(id: CustomWorkflowId, change: WorkflowChange): CustomEntry {
      const old = entries.get(id)
      if (!old) throw new Error('No such workflow')
      if (change.name !== undefined && nameTaken(change.name, id)) {
        throw refuse('workflow_name_taken')
      }
      const stored: StoredCustomWorkflow = {
        ...old.stored,
        name: change.name ?? old.stored.name,
        size: change.size ?? old.stored.size,
        video: change.video ?? old.stored.video,
      }
      const entry = entryOf(stored, old.checked)
      save(stored)
      entries.set(id, entry)
      return entry
    },

    // Deletes {dir}/{id}.json and nothing else. False when the ID is not in the store.
    remove(id: string): boolean {
      const entry = get(id)
      if (!entry) return false
      try {
        fs.rmSync(fileOf(entry.stored.id), { force: true })
      } catch {
        throw new Error(REMOVE_FAILED)
      }
      entries.delete(entry.stored.id)
      return true
    },
  }
}
