import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, data, type Fixture } from '../core-fixture'
import { readMeta } from '@/main/db/meta'
import type { AppState } from '@/shared/schemas/queries/app'
import type { OpenProjectSummary } from '@/shared/schemas/project'

let f: Fixture
afterEach(() => f.cleanup())

describe('project meta is not cached [SPEC 3.3, correction 18]', () => {
  it('keeps only the project ID and file path on the open-project handle', async () => {
    f = makeFixture()
    const p = data<OpenProjectSummary>(
      await f.user('project.create', { name: 'Summer', location: f.projectsDir }),
    )
    const handle = f.core.projects.requireOpen(p.projectId)
    expect(handle).not.toHaveProperty('meta')
    expect(handle.projectId).toBe(p.projectId)
    expect(handle.filePath).toBe(path.join(f.projectsDir, 'Summer.adman'))
  })

  it('shows a changed project_meta value in app.getState and in the next read', async () => {
    f = makeFixture()
    const p = data<OpenProjectSummary>(
      await f.user('project.create', { name: 'Summer', location: f.projectsDir }),
    )
    const { db } = f.core.projects.requireOpen(p.projectId)
    db.prepare("UPDATE project_meta SET value = 'Winter' WHERE key = 'name'").run()
    const state = data<AppState>(await f.core.query('app.getState', {}, { actor: 'user' }))
    expect(state.openProjects).toEqual([{ ...p, name: 'Winter' }])
    expect(readMeta(db).name).toBe('Winter')
  })
})
