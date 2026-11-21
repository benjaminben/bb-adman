import fs from 'node:fs'
import Database from 'better-sqlite3'
import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, data, type Fixture } from '../core-fixture'

let f: Fixture | undefined
afterEach(() => {
  f?.cleanup()
  f = undefined
})

const NOT_A_PROJECT = 'This file is not an Adman project, or it is damaged.'

async function closedProject(fx: Fixture) {
  const a = data<{ projectId: string; filePath: string }>(
    await fx.user('project.create', { name: 'A', location: fx.projectsDir }),
  )
  data(await fx.user('project.close', { projectId: a.projectId }))
  return a.filePath
}

function setStoredName(filePath: string, name: string) {
  const raw = new Database(filePath)
  raw.prepare("UPDATE project_meta SET value = ? WHERE key = 'name'").run(name)
  raw.close()
}

describe('project.open checks the stored project name [SPEC 14 1.30 U1, 8.1]', () => {
  for (const name of ['../../x', 'a/b', '..', '.hidden', '', 'trailing ']) {
    it(`refuses a project whose stored name is ${JSON.stringify(name)}, writing nothing`, async () => {
      f = makeFixture()
      const filePath = await closedProject(f)
      setStoredName(filePath, name)
      const before = fs.readFileSync(filePath)
      expect(await f.user('project.open', { filePath })).toEqual({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: NOT_A_PROJECT,
          details: { reason: 'not_a_project' },
        },
      })
      expect(f.core.projects.all()).toEqual([])
      expect(fs.readFileSync(filePath).equals(before)).toBe(true)
      expect(fs.existsSync(`${filePath}.bak`)).toBe(false)
    })
  }

  it('opens a project made by project.create', async () => {
    f = makeFixture()
    const filePath = await closedProject(f)
    expect(await f.user('project.open', { filePath })).toMatchObject({
      ok: true,
      data: { name: 'A', filePath },
    })
  })
})
