// spec/jobs.md, "Closing a project and quitting"; spec/screens-ai.md, "Attached jobs and the
// close warning": quitting closes every open project through project.close with 'stop'
// (closeAllStopping in core.ts). No job row stays queued or running in a file closed this way.
import { describe, expect, it, afterEach } from 'vitest'
import { makeGenerationFixture, waitFor, VARIANT } from '../generation/generation-fixture'
import { data } from '../core-fixture'
import { openProjectFile, closeProjectFile } from '@/main/db/project-file'
import { readWireRows } from '@/main/db/rows'
import { resetFakeBehaviour, setFakeBehaviour } from '@/main/providers/fake/behaviour'
import type { GenerationFixture } from '../generation/generation-fixture'
import type { JobRow } from '@/shared/schemas/rows/job'

let f: GenerationFixture
afterEach(() => {
  resetFakeBehaviour()
  f.cleanup()
})

const start = async () =>
  data<{ jobId: string }>(
    await f.user('generation.runImages', {
      variantId: VARIANT,
      slot: 'background',
      prompt: 'A bottle on a rock',
      referenceAssetIds: [],
      count: 1,
      provider: 'fake',
    }),
  ).jobId

// A queued row as an earlier run could leave it, beside the live one.
function insertQueued(id: string) {
  f.db
    .prepare(
      `INSERT INTO job (id, kind, status, provider, model, request, created_at, updated_at)
       VALUES (?, 'layout_proposal', 'queued', 'gemini', 'm1', '{}', ?, ?)`,
    )
    .run(id, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')
}

// The rows as the closed file holds them, read without the open rule.
function storedStatuses(filePath: string): Record<string, string> {
  const again = openProjectFile({ filePath, appVersion: '0.1.0' })
  try {
    const rows = readWireRows(again.db, 'job') as JobRow[]
    return Object.fromEntries(rows.map((r) => [r.id, r.status]))
  } finally {
    closeProjectFile(again)
  }
}

describe('closeAllStopping [spec/jobs.md "Closing a project and quitting", P4-10]', () => {
  it('stops every run, closes every project, and leaves no row queued or running', async () => {
    f = await makeGenerationFixture()
    setFakeBehaviour({ waitMs: 10_000, onCancel: 'stop' })
    const jobId = await start()
    insertQueued('left-queued')
    await waitFor(() => f.job(jobId)?.status === 'running')
    const filePath = f.project.filePath

    await f.core.closeAllStopping()

    expect(f.core.projects.all()).toHaveLength(0)
    expect(storedStatuses(filePath)).toEqual({ [jobId]: 'cancelled', 'left-queued': 'cancelled' })
  })

  it('closes every project when nothing runs', async () => {
    f = await makeGenerationFixture()
    await f.core.closeAllStopping()
    expect(f.core.projects.all()).toHaveLength(0)
  })
})
