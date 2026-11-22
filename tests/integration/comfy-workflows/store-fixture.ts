// A custom workflow store over a temporary folder, with the log lines it writes kept in
// memory (D-104, CW-2).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { ActivityLog, LogInput } from '@/main/log/activity-log'
import { createCustomWorkflowStore } from '@/main/providers/comfyui/custom/store'
import { checkWorkflowText, type CheckedWorkflow } from '@/main/providers/comfyui/custom/check-file'
import { fixtureText, type CustomFixture } from '../../fixtures/comfy-custom/load'

export type StoreFixture = {
  root: string
  dir: string
  lines: LogInput[]
  open: () => ReturnType<typeof createCustomWorkflowStore>
  cleanup: () => void
}

export function makeStoreFixture(): StoreFixture {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-workflows-'))
  const dir = path.join(root, 'comfy-workflows')
  const lines: LogInput[] = []
  const log: ActivityLog = { write: (line) => lines.push(line), prune: () => {} }
  let tick = 0
  // Each add a second later than the one before, so the order by addedAt is known.
  const now = () => new Date(Date.UTC(2026, 10, 22, 10, 0, tick++))
  return {
    root,
    dir,
    lines,
    open: () => createCustomWorkflowStore({ dir, log, now }),
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  }
}

export function checked(name: CustomFixture): CheckedWorkflow {
  const result = checkWorkflowText(fixtureText(name))
  if (!result.ok) throw new Error(`fixture ${name} failed the checks`)
  return result.data
}
