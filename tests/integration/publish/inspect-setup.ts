// P9-9 test helper: a core over temporary folders with a component project open in it. The
// project is written by plain SQL (component-project.ts), as a hostile project file could hold
// it, then closed and opened through project.open. Storage is local storage on a temporary
// folder, handed in through storageFor; nothing reaches a bucket or Dropbox. Not a test file.
import fs from 'node:fs'
import path from 'node:path'
import { closeProjectFile } from '@/main/db/project-file'
import { localStorageAt } from '@/main/providers/local-storage'
import type { StorageProvider } from '@/main/providers/types'
import { data, makeFixture, type Fixture } from '../core-fixture'
import { CAMPAIGN, makeComponentProject } from './component-project'

type Project = ReturnType<typeof makeComponentProject>

export const id = (n: number) => `01JD${String(n).padStart(22, '0')}`

export type InspectSetUp = {
  fx: Fixture
  projectId: string
  storageRoot: string
  // Every storage the query opened, in order.
  opened: string[]
  inspect(input: object, actor?: 'user' | 'agent'): ReturnType<Fixture['core']['query']>
  cleanup(): void
}

// `build` adds the rows before the project file is closed and opened in the core.
export async function inspectSetUp(
  build: (p: Project) => void,
  opts: { env?: Record<string, string>; storage?: StorageProvider } = {},
): Promise<InspectSetUp> {
  const fx = makeFixture({ env: opts.env ?? {} })
  const p = makeComponentProject()
  build(p)
  const filePath = p.handle.filePath
  closeProjectFile(p.handle)
  const { projectId } = data<{ projectId: string }>(await fx.user('project.open', { filePath }))
  const storageRoot = path.join(fx.root, 'storage')
  fs.mkdirSync(storageRoot, { recursive: true })
  const opened: string[] = []
  const storage = opts.storage ?? localStorageAt(storageRoot)
  fx.core.deps.publish.storageFor = (_deps, id) => {
    opened.push(id)
    return storage
  }
  return {
    fx,
    projectId,
    storageRoot,
    opened,
    inspect: (input, actor = 'user') =>
      fx.core.query('publish.inspect', { projectId, campaignId: CAMPAIGN, ...input }, { actor }),
    cleanup() {
      fx.cleanup()
      fs.rmSync(p.dir, { recursive: true, force: true })
    },
  }
}
